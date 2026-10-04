import { z } from "zod";
import { addDays, monthOf, type DateString } from "@/lib/dates";
import { WORKOUT_LABEL, WORKOUT_TYPES, DISTANCE_TYPES } from "@/lib/fitness/activities";
import {
  ageFromBirthYear,
  assessBmi,
  BMI_LABEL,
  formatBmi,
  normalWeightRange,
} from "@/lib/fitness/bmi";
import { goalSafety } from "@/lib/fitness/goals";
import {
  cmToMm,
  formatDistance,
  formatDuration,
  formatHeight,
  formatKcal,
  formatWeight,
  formatWeightDelta,
  kgToGrams,
} from "@/lib/fitness/units";
import { LIMITS, SEXES } from "@/lib/validation/fitness";
import { getModuleState } from "@/server/services/modules";
import {
  addWorkout,
  deleteWorkout,
  getActiveGoal,
  getBmi,
  getFitnessDashboard,
  getGoalView,
  getProfile,
  removeGoal,
  restoreGoal,
  revertGoal,
  revertMeasurement,
  saveMeasurement,
  setWeightGoal,
  weekOf,
  weightHistory,
  weightOn,
  workoutSummary,
  type GoalView,
  type MeasurementUndo,
} from "@/server/services/fitness";
import { dayLabel } from "../../format";
import { defineTool, explicit, isoDate, ToolError, type ToolContext } from "../../tools";

/*
 * Spor & Sağlık araçları. Değerler servislerden gelir ve burada Türkçe biçimlendirilir;
 * model kendi hesap yapmaz. Sağlık verisi hassastır: araç sonuçları yalnızca kullanıcının
 * kendi sohbetine gider. Hedef oluşturma ve silme her zaman onay kartıyla yapılır.
 */

export const BMI_NOTE =
  "VKİ tek başına sağlık durumunu göstermez; kas kütlesi, yaş ve vücut yapısı sonucu etkiler. Çocuklar, ergenler ve hamileler için yetişkin sınıflaması uygun değildir.";
export const GOAL_NOTE =
  "Kilo hedeflerinde bir sağlık uzmanına danışmak her zaman iyi bir fikirdir.";

async function ensureEnabled(ctx: ToolContext) {
  const state = await getModuleState(ctx.db, ctx.user.id, "fitness");
  if (!state.enabled) throw new ToolError("module_disabled");
}

const date = isoDate
  .optional()
  .describe("Date YYYY-MM-DD in the user's time zone; omit for today.");
const heightCm = z
  .number()
  .min(LIMITS.heightCm.min)
  .max(LIMITS.heightCm.max)
  .describe("Height in centimetres, e.g. 180 (convert 1.80 m to 180).");
const weightKg = z
  .number()
  .min(LIMITS.weightKg.min)
  .max(LIMITS.weightKg.max)
  .describe("Body weight in kilograms, decimals allowed.");

function bmiData(weightG: number, heightMm: number, age: number | null) {
  const a = assessBmi(weightG, heightMm, age);
  const range = normalWeightRange(heightMm);
  return {
    bmi: formatBmi(a.value),
    category: a.category ? BMI_LABEL[a.category] : null,
    categoryNote: a.category
      ? "Standart yetişkin sınıflaması."
      : "18 yaş altı için yetişkin sınıflaması uygulanmaz.",
    normalRangeForHeight: `${formatWeight(range.minG)} – ${formatWeight(range.maxG)}`,
    disclaimer: BMI_NOTE,
  };
}

function goalData(goal: GoalView, today: DateString) {
  const p = goal.progress;
  return {
    start: formatWeight(goal.startG),
    current: formatWeight(goal.currentG),
    target: formatWeight(goal.targetG),
    direction:
      p.direction === "lose" ? "kilo verme" : p.direction === "gain" ? "kilo alma" : "koruma",
    progressPercent: Math.round(p.ratio * 100),
    remaining: formatWeight(p.remainingG),
    reached: p.reached,
    targetDate: goal.targetDate ? dayLabel(goal.targetDate, today) : null,
    estimatedWeeksLeft: goal.etaDays === null ? null : Math.max(1, Math.round(goal.etaDays / 7)),
    estimateNote:
      goal.etaDays === null && !p.reached
        ? "Tahmin için en az bir haftaya yayılan iki ölçüm ve hedefe doğru bir eğilim gerekir."
        : null,
    safetyWarning: safetyText(goal.safety, today),
    note: GOAL_NOTE,
  };
}

function safetyText(s: GoalView["safety"], today: DateString) {
  const parts: string[] = [];
  if (s.tooFast && s.requiredGPerWeek) {
    parts.push(
      `Bu tarih için haftada yaklaşık ${formatWeight(s.requiredGPerWeek)} değişim gerekir; bu genelde önerilenden hızlıdır.${s.saferDate ? ` Daha gerçekçi bir tarih: ${dayLabel(s.saferDate, today)}.` : ""}`,
    );
  }
  if (s.belowHealthyRange) parts.push("Hedef kilo bu boy için VKİ 18,5'in altına düşüyor.");
  return parts.length ? `${parts.join(" ")} Bir sağlık uzmanına danışmanı öneririm.` : null;
}

/* ------------------------------------------------------------------ Okuma */

const getFitnessDashboardTool = defineTool({
  name: "get_fitness_dashboard",
  description:
    "Overview of the Sport & Health module: BMI, latest weight, this week's workouts and the weight goal.",
  kind: "read",
  label: "Spor özetine bakıyorum",
  doneLabel: "Spor özetine baktım",
  schema: z.object({}),
  async run(ctx) {
    await ensureEnabled(ctx);
    const d = await getFitnessDashboard(ctx.db, ctx.user.id, ctx.today);
    return {
      data: {
        bmi: d.bmi
          ? {
              ...bmiData(d.bmi.weightG, d.bmi.heightMm, d.profile?.age ?? null),
              measured: dayLabel(d.bmi.measuredOn, ctx.today),
            }
          : null,
        weight: d.weight.latest
          ? {
              latest: formatWeight(d.weight.latest.weightG),
              measured: dayLabel(d.weight.latest.date, ctx.today),
              changeFromPrevious:
                d.weight.deltaG === null ? null : formatWeightDelta(d.weight.deltaG),
            }
          : null,
        thisWeek: {
          workouts: d.week.count,
          activeDays: d.week.activeDays,
          duration: formatDuration(d.week.minutes),
          estimatedCalories: formatKcal(d.week.calories),
        },
        goal: d.goal ? goalData(d.goal, ctx.today) : null,
        missing: [
          ...(d.profile?.heightMm ? [] : ["height"]),
          ...(d.weight.latest ? [] : ["weight"]),
        ],
      },
    };
  },
});

const calculateBmi = defineTool({
  name: "calculate_bmi",
  description:
    "Calculate BMI. Without inputs it uses the saved height and latest weight. Pass height_cm/weight_kg only to calculate for values the user just gave without saving them. If something is missing the result lists it: ask only for the missing value.",
  kind: "read",
  label: "VKİ'yi hesaplıyorum",
  doneLabel: "VKİ hesaplandı",
  schema: z.object({ height_cm: heightCm.optional(), weight_kg: weightKg.optional() }),
  async run(ctx, input) {
    await ensureEnabled(ctx);
    const [profile, latest] = await Promise.all([
      getProfile(ctx.db, ctx.user.id),
      weightOn(ctx.db, ctx.user.id, ctx.today),
    ]);
    const heightMm = input.height_cm ? cmToMm(input.height_cm) : (profile?.heightMm ?? null);
    const weightG = input.weight_kg ? kgToGrams(input.weight_kg) : (latest?.weightG ?? null);
    const missing = [...(heightMm ? [] : ["height"]), ...(weightG ? [] : ["weight"])];
    if (!heightMm || !weightG) {
      return {
        data: {
          missing,
          known: {
            height: heightMm ? formatHeight(heightMm) : null,
            weight: weightG ? formatWeight(weightG) : null,
          },
        },
      };
    }
    const data = bmiData(
      weightG,
      heightMm,
      ageFromBirthYear(profile?.birthYear ?? null, ctx.today),
    );
    return {
      data: {
        ...data,
        height: formatHeight(heightMm),
        weight: formatWeight(weightG),
        usedSavedValues: !input.height_cm && !input.weight_kg,
      },
      card: {
        icon: "fitness",
        title: `VKİ ${data.bmi}${data.category ? ` · ${data.category}` : ""}`,
        lines: [
          `${formatHeight(heightMm)} · ${formatWeight(weightG)}`,
          "VKİ tek başına sağlık durumunu göstermez",
        ],
        href: "/fitness",
      },
    };
  },
});

const getWeightHistory = defineTool({
  name: "get_weight_history",
  description:
    "Weight history: latest weight, change since previous measurement, last 30 days, this month and since the first record.",
  kind: "read",
  label: "Kilo geçmişine bakıyorum",
  doneLabel: "Kilo geçmişine baktım",
  schema: z.object({}),
  async run(ctx) {
    await ensureEnabled(ctx);
    const h = await weightHistory(ctx.db, ctx.user.id, ctx.today);
    const span = (s: { fromDate: DateString; deltaG: number } | null) =>
      s ? { since: dayLabel(s.fromDate, ctx.today), change: formatWeightDelta(s.deltaG) } : null;
    return {
      data: {
        latest: h.latest
          ? { weight: formatWeight(h.latest.weightG), date: dayLabel(h.latest.date, ctx.today) }
          : null,
        previous: h.previous
          ? { weight: formatWeight(h.previous.weightG), date: dayLabel(h.previous.date, ctx.today) }
          : null,
        changeFromPrevious: h.deltaG === null ? null : formatWeightDelta(h.deltaG),
        last30Days: span(h.last30),
        thisMonth: span(h.thisMonth),
        sinceFirstRecord: span(h.total),
        measurements: h.points.length,
      },
    };
  },
});

const PERIODS = ["this_week", "last_week", "last_7_days", "this_month"] as const;

function periodRange(period: (typeof PERIODS)[number], today: DateString) {
  switch (period) {
    case "this_week":
      return { from: weekOf(today).start, to: today, label: "Bu hafta" };
    case "last_week": {
      const start = addDays(weekOf(today).start, -7);
      return { from: start, to: addDays(start, 6), label: "Geçen hafta" };
    }
    case "last_7_days":
      return { from: addDays(today, -6), to: today, label: "Son 7 gün" };
    case "this_month":
      return { from: monthOf(today).start, to: today, label: "Bu ay" };
  }
}

const getWorkoutSummary = defineTool({
  name: "get_workout_summary",
  description:
    "Workout summary for a period: count, active days, total duration, estimated calories and activity types.",
  kind: "read",
  label: "Aktivitelerine bakıyorum",
  doneLabel: "Aktivitelerine baktım",
  schema: z.object({ period: z.enum(PERIODS).default("this_week") }),
  async run(ctx, { period }) {
    await ensureEnabled(ctx);
    const r = periodRange(period, ctx.today);
    const s = await workoutSummary(ctx.db, ctx.user.id, r.from, r.to);
    return {
      data: {
        period: r.label,
        workouts: s.count,
        activeDays: s.activeDays,
        duration: formatDuration(s.minutes),
        estimatedCalories: formatKcal(s.calories),
        distance: s.distanceM ? formatDistance(s.distanceM) : null,
        byType: s.byType.map((t) => ({
          type: WORKOUT_LABEL[t.type],
          count: t.count,
          duration: formatDuration(t.minutes),
        })),
      },
    };
  },
});

const getFitnessProgress = defineTool({
  name: "get_fitness_progress",
  description:
    "Progress toward the active weight goal: percent done, remaining, estimated time at the current trend.",
  kind: "read",
  label: "Hedefine bakıyorum",
  doneLabel: "Hedefine baktım",
  schema: z.object({}),
  async run(ctx) {
    await ensureEnabled(ctx);
    const goal = await getGoalView(ctx.db, ctx.user.id, ctx.today);
    return { data: goal ? goalData(goal, ctx.today) : { goal: null } };
  },
});

/* ----------------------------------------------------------------- Yazma */

const saveBodyMeasurement = defineTool({
  name: "save_body_measurement",
  description:
    "Save height, weight (today's or a given day's measurement), age and/or sex. Give only what the user said. Returns the new BMI when height and weight are known.",
  kind: "write",
  label: "Ölçümü hazırlıyorum",
  schema: z.object({
    height_cm: heightCm.optional(),
    weight_kg: weightKg.optional(),
    age: z.number().int().min(LIMITS.age.min).max(LIMITS.age.max).optional(),
    sex: z.enum(SEXES).optional(),
    date,
    explicit_command: explicit,
  }),
  async preview(ctx, input) {
    return {
      icon: "weight",
      title: measurementTitle(input),
      lines: [dayLabel(input.date ?? ctx.today, ctx.today)],
      href: "/fitness",
    };
  },
  async run(ctx, input) {
    await ensureEnabled(ctx);
    if (!input.height_cm && !input.weight_kg && !input.age && !input.sex)
      throw new ToolError("invalid_input");
    const day = input.date ?? ctx.today;
    const { undo } = await saveMeasurement(
      ctx.db,
      ctx.user.id,
      {
        heightCm: input.height_cm ?? null,
        weightKg: input.weight_kg ?? null,
        age: input.age ?? null,
        sex: input.sex ?? null,
        date: day,
      },
      { today: ctx.today, via: "ai" },
    );
    const [bmi, profile, history] = await Promise.all([
      getBmi(ctx.db, ctx.user.id, ctx.today),
      getProfile(ctx.db, ctx.user.id),
      weightHistory(ctx.db, ctx.user.id, ctx.today),
    ]);
    const bmiInfo = bmi
      ? bmiData(bmi.weightG, bmi.heightMm, ageFromBirthYear(profile?.birthYear ?? null, ctx.today))
      : null;
    return {
      data: {
        saved: true,
        height: input.height_cm ? formatHeight(cmToMm(input.height_cm)) : null,
        weight: input.weight_kg ? formatWeight(kgToGrams(input.weight_kg)) : null,
        changeFromPrevious:
          input.weight_kg && history.deltaG !== null && history.latest?.date === day
            ? formatWeightDelta(history.deltaG)
            : null,
        bmi: bmiInfo,
        missingForBmi: bmi
          ? []
          : [...(profile?.heightMm ? [] : ["height"]), ...(history.latest ? [] : ["weight"])],
      },
      card: {
        icon: "weight",
        title: measurementTitle(input),
        lines: [
          dayLabel(day, ctx.today),
          ...(bmiInfo
            ? [`VKİ ${bmiInfo.bmi}${bmiInfo.category ? ` · ${bmiInfo.category}` : ""}`]
            : []),
        ],
        href: "/fitness",
      },
      undo,
    };
  },
  async undo(ctx, undo) {
    await revertMeasurement(ctx.db, ctx.user.id, undo as MeasurementUndo);
  },
});

function measurementTitle(input: {
  height_cm?: number;
  weight_kg?: number;
  age?: number;
  sex?: string;
}) {
  const parts = [
    input.height_cm ? `Boy ${formatHeight(cmToMm(input.height_cm))}` : null,
    input.weight_kg ? `Kilo ${formatWeight(kgToGrams(input.weight_kg))}` : null,
    input.age ? `${input.age} yaş` : null,
    input.sex ? { female: "Kadın", male: "Erkek", other: "Diğer" }[input.sex] : null,
  ].filter(Boolean);
  return parts.join(" · ") || "Ölçüm";
}

const saveWorkout = defineTool({
  name: "save_workout",
  description:
    "Log a workout. type and duration_min are required: if the user did not say them, ask only for what is missing instead of calling this tool. Calories are estimated when not given.",
  kind: "write",
  label: "Aktiviteyi hazırlıyorum",
  schema: z.object({
    type: z
      .enum(WORKOUT_TYPES)
      .describe(
        "walking, running, cycling, swimming, fitness (gym), strength (weights), football, basketball, yoga, other",
      ),
    duration_min: z.number().int().min(LIMITS.durationMin.min).max(LIMITS.durationMin.max),
    distance_km: z.number().min(LIMITS.distanceKm.min).max(LIMITS.distanceKm.max).optional(),
    calories: z.number().int().min(LIMITS.calories.min).max(LIMITS.calories.max).optional(),
    date,
    note: z.string().trim().max(200).optional(),
    explicit_command: explicit,
  }),
  async preview(ctx, input) {
    return {
      icon: "fitness",
      title: `${WORKOUT_LABEL[input.type]} · ${formatDuration(input.duration_min)}`,
      lines: [dayLabel(input.date ?? ctx.today, ctx.today)],
      href: "/fitness",
    };
  },
  async run(ctx, input) {
    await ensureEnabled(ctx);
    const day = input.date ?? ctx.today;
    const w = await addWorkout(
      ctx.db,
      ctx.user.id,
      {
        type: input.type,
        durationMin: input.duration_min,
        distanceKm:
          input.distance_km && DISTANCE_TYPES.includes(input.type) ? input.distance_km : null,
        calories: input.calories ?? null,
        date: day,
        note: input.note ?? "",
      },
      { today: ctx.today, via: "ai" },
    );
    const week = weekOf(ctx.today);
    const s = await workoutSummary(ctx.db, ctx.user.id, week.start, ctx.today);
    const kcal = w.calories
      ? `${w.caloriesEstimated ? "tahmini " : ""}${formatKcal(w.calories)}`
      : null;
    return {
      data: {
        saved: true,
        activity: WORKOUT_LABEL[w.type],
        duration: formatDuration(w.durationMin),
        distance: w.distanceM ? formatDistance(w.distanceM) : null,
        calories: kcal,
        date: dayLabel(day, ctx.today),
        thisWeek: {
          workouts: s.count,
          activeDays: s.activeDays,
          duration: formatDuration(s.minutes),
        },
      },
      card: {
        icon: "fitness",
        title: `${WORKOUT_LABEL[w.type]} · ${formatDuration(w.durationMin)}`,
        lines: [
          [dayLabel(day, ctx.today), w.distanceM ? formatDistance(w.distanceM) : null, kcal]
            .filter(Boolean)
            .join(" · "),
        ],
        href: "/fitness",
      },
      undo: { id: w.id },
    };
  },
  async undo(ctx, undo) {
    await deleteWorkout(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

const createFitnessGoal = defineTool({
  name: "create_fitness_goal",
  description:
    "Create or replace the weight goal (e.g. '82 kilodan 75 kiloya düşmek istiyorum'). start_kg defaults to the latest weight. Always confirmed by the user; the card shows safety notes. Never encourage losing more than about 1 kg per week.",
  kind: "sensitive",
  label: "Hedef önerisini hazırlıyorum",
  schema: z.object({
    target_kg: weightKg,
    start_kg: weightKg.optional(),
    target_date: isoDate.optional(),
  }),
  async preview(ctx, input) {
    await ensureEnabled(ctx);
    const startG = input.start_kg
      ? kgToGrams(input.start_kg)
      : (await weightOn(ctx.db, ctx.user.id, ctx.today))?.weightG;
    if (!startG) throw new ToolError("invalid_input");
    const profile = await getProfile(ctx.db, ctx.user.id);
    const safety = goalSafety(
      startG,
      kgToGrams(input.target_kg),
      input.target_date ?? null,
      ctx.today,
      profile?.heightMm ?? null,
    );
    const previous = await getActiveGoal(ctx.db, ctx.user.id);
    return {
      icon: "goal",
      title: `Hedef: ${formatWeight(startG)} → ${formatWeight(kgToGrams(input.target_kg))}`,
      lines: [
        input.target_date ? `Hedef tarih: ${dayLabel(input.target_date, ctx.today)}` : "Tarihsiz",
        ...(previous ? ["Mevcut hedefin yerine geçer"] : []),
        ...(safetyText(safety, ctx.today) ? [safetyText(safety, ctx.today)!] : []),
      ],
      href: "/fitness",
    };
  },
  async run(ctx, input) {
    await ensureEnabled(ctx);
    const res = await setWeightGoal(
      ctx.db,
      ctx.user.id,
      {
        startKg: input.start_kg ?? null,
        targetKg: input.target_kg,
        targetDate: input.target_date ?? null,
      },
      { today: ctx.today, via: "ai" },
    );
    const goal = await getGoalView(ctx.db, ctx.user.id, ctx.today);
    return {
      data: { saved: true, ...(goal ? goalData(goal, ctx.today) : {}) },
      card: {
        icon: "goal",
        title: goal
          ? `Hedef: ${formatWeight(goal.startG)} → ${formatWeight(goal.targetG)}`
          : "Hedef kaydedildi",
        lines: [
          goal?.targetDate ? `Hedef tarih: ${dayLabel(goal.targetDate, ctx.today)}` : "Tarihsiz",
        ],
        href: "/fitness",
      },
      undo: res,
    };
  },
  async undo(ctx, undo) {
    await revertGoal(ctx.db, ctx.user.id, undo as { id: string; previousId: string | null });
  },
});

const deleteFitnessGoal = defineTool({
  name: "delete_fitness_goal",
  description: "Remove the active weight goal. Always confirmed by the user.",
  kind: "sensitive",
  label: "Hedefi kaldırmayı hazırlıyorum",
  schema: z.object({}),
  async preview(ctx) {
    const goal = await getActiveGoal(ctx.db, ctx.user.id);
    if (!goal) throw new ToolError("not_found");
    return {
      icon: "delete",
      title: `Hedefi kaldır: ${formatWeight(goal.targetG)}`,
      lines: ["Kilo kayıtların silinmez"],
      href: "/fitness",
    };
  },
  async run(ctx) {
    await ensureEnabled(ctx);
    const goal = await getActiveGoal(ctx.db, ctx.user.id);
    if (!goal) throw new ToolError("not_found");
    await removeGoal(ctx.db, ctx.user.id, goal.id);
    return {
      data: { removed: true },
      card: {
        icon: "delete",
        title: `Hedef kaldırıldı: ${formatWeight(goal.targetG)}`,
        lines: ["Kilo kayıtların duruyor"],
        href: "/fitness",
      },
      undo: { id: goal.id },
    };
  },
  async undo(ctx, undo) {
    await restoreGoal(ctx.db, ctx.user.id, (undo as { id: string }).id);
  },
});

export const FITNESS_TOOLS = [
  getFitnessDashboardTool,
  calculateBmi,
  getWeightHistory,
  getWorkoutSummary,
  getFitnessProgress,
  saveBodyMeasurement,
  saveWorkout,
  createFitnessGoal,
  deleteFitnessGoal,
];
