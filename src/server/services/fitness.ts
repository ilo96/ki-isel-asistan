import { and, asc, desc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { addDays, daysBetween, monthOf, type DateString } from "@/lib/dates";
import { estimateCalories, type WorkoutType } from "@/lib/fitness/activities";
import { ageFromBirthYear, assessBmi, type BmiAssessment } from "@/lib/fitness/bmi";
import {
  etaDays,
  goalProgress,
  goalSafety,
  weightTrend,
  type GoalProgress,
  type GoalSafety,
} from "@/lib/fitness/goals";
import { cmToMm, kgToGrams, kmToMeters } from "@/lib/fitness/units";
import {
  goalSchema,
  measurementSchema,
  workoutSchema,
  type GoalInput,
  type MeasurementInput,
  type Sex,
  type WorkoutInput,
} from "@/lib/validation/fitness";
import type { Db } from "@/server/db/client";
import {
  bodyProfiles,
  fitnessGoals,
  weightRecords,
  workouts,
  type Workout,
} from "@/server/db/schema";

/*
 * Spor & Sağlık servisi: ekran, asistan araçları ve bildirimler aynı fonksiyonları kullanır.
 * Her sorgu user_id ile filtrelenir. Sağlık verileri hassastır: hata mesajları ve loglar
 * değer içermez, yalnızca hata kodu taşır.
 */

export class FitnessError extends Error {
  constructor(readonly code: "not_found" | "no_height" | "no_weight" | "invalid" | "disabled") {
    super(code);
    this.name = "FitnessError";
  }
}

type Via = "manual" | "ai" | "onboarding";

/* ---------------------------------------------------------------- Profil */

export type Profile = { heightMm: number | null; birthYear: number | null; sex: Sex | null };

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const [row] = await db
    .select({
      heightMm: bodyProfiles.heightMm,
      birthYear: bodyProfiles.birthYear,
      sex: bodyProfiles.sex,
    })
    .from(bodyProfiles)
    .where(eq(bodyProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

/* ----------------------------------------------------------------- Kilo */

export type WeightEntry = { id: string; date: DateString; weightG: number };

export async function listWeights(
  db: Db,
  userId: string,
  opts: { from?: DateString; to?: DateString } = {},
) {
  const rows = await db
    .select({
      id: weightRecords.id,
      date: weightRecords.measuredOn,
      weightG: weightRecords.weightG,
    })
    .from(weightRecords)
    .where(
      and(
        eq(weightRecords.userId, userId),
        opts.from ? gte(weightRecords.measuredOn, opts.from) : undefined,
        opts.to ? lte(weightRecords.measuredOn, opts.to) : undefined,
      ),
    )
    .orderBy(asc(weightRecords.measuredOn));
  return rows as WeightEntry[];
}

/** Belirli bir güne kadarki son ölçüm (yoksa null). */
export async function weightOn(
  db: Db,
  userId: string,
  day: DateString,
): Promise<WeightEntry | null> {
  const [row] = await db
    .select({
      id: weightRecords.id,
      date: weightRecords.measuredOn,
      weightG: weightRecords.weightG,
    })
    .from(weightRecords)
    .where(and(eq(weightRecords.userId, userId), lte(weightRecords.measuredOn, day)))
    .orderBy(desc(weightRecords.measuredOn))
    .limit(1);
  return (row as WeightEntry | undefined) ?? null;
}

/* ------------------------------------------------------------ Ölçüm kaydı */

export type MeasurementUndo = {
  /** undefined: profil değişmedi; null: önceden profil yoktu. */
  profile?: Profile | null;
  weight?: { date: DateString; previousG: number | null };
};

/** Boy, kilo, yaş ve cinsiyetten verilenleri kaydeder; geri almak için önceki hali döner. */
export async function saveMeasurement(
  db: Db,
  userId: string,
  input: MeasurementInput,
  opts: { today: DateString; via?: Via },
): Promise<{ undo: MeasurementUndo }> {
  const data = measurementSchema.parse(input);
  if (data.date > opts.today) throw new FitnessError("invalid");
  const undo: MeasurementUndo = {};

  if (data.heightCm !== null || data.age !== null || data.sex !== null) {
    const before = await getProfile(db, userId);
    undo.profile = before;
    const next: Profile = {
      heightMm: data.heightCm !== null ? cmToMm(data.heightCm) : (before?.heightMm ?? null),
      birthYear:
        data.age !== null ? Number(opts.today.slice(0, 4)) - data.age : (before?.birthYear ?? null),
      sex: data.sex ?? before?.sex ?? null,
    };
    await db
      .insert(bodyProfiles)
      .values({ userId, ...next })
      .onConflictDoUpdate({ target: bodyProfiles.userId, set: next });
  }

  if (data.weightKg !== null) {
    const [existing] = await db
      .select({ weightG: weightRecords.weightG })
      .from(weightRecords)
      .where(and(eq(weightRecords.userId, userId), eq(weightRecords.measuredOn, data.date)))
      .limit(1);
    undo.weight = { date: data.date, previousG: existing?.weightG ?? null };
    const weightG = kgToGrams(data.weightKg);
    await db
      .insert(weightRecords)
      .values({ userId, weightG, measuredOn: data.date, createdVia: opts.via ?? "manual" })
      .onConflictDoUpdate({
        target: [weightRecords.userId, weightRecords.measuredOn],
        set: { weightG },
      });
  }
  return { undo };
}

export async function revertMeasurement(db: Db, userId: string, undo: MeasurementUndo) {
  if (undo.profile === null) {
    await db.delete(bodyProfiles).where(eq(bodyProfiles.userId, userId));
  } else if (undo.profile) {
    await db.update(bodyProfiles).set(undo.profile).where(eq(bodyProfiles.userId, userId));
  }
  if (undo.weight) {
    const where = and(
      eq(weightRecords.userId, userId),
      eq(weightRecords.measuredOn, undo.weight.date),
    );
    if (undo.weight.previousG === null) await db.delete(weightRecords).where(where);
    else await db.update(weightRecords).set({ weightG: undo.weight.previousG }).where(where);
  }
}

export async function deleteWeight(db: Db, userId: string, id: string) {
  const [row] = await db
    .delete(weightRecords)
    .where(and(eq(weightRecords.id, id), eq(weightRecords.userId, userId)))
    .returning({ date: weightRecords.measuredOn, weightG: weightRecords.weightG });
  if (!row) throw new FitnessError("not_found");
  return row;
}

export async function restoreWeight(
  db: Db,
  userId: string,
  row: { date: DateString; weightG: number },
) {
  await db
    .insert(weightRecords)
    .values({ userId, measuredOn: row.date, weightG: row.weightG })
    .onConflictDoUpdate({
      target: [weightRecords.userId, weightRecords.measuredOn],
      set: { weightG: row.weightG },
    });
}

/* ---------------------------------------------------------------- Spor */

export type WorkoutItem = {
  id: string;
  type: WorkoutType;
  durationMin: number;
  distanceM: number | null;
  calories: number | null;
  caloriesEstimated: boolean;
  date: DateString;
  note: string | null;
};

const toItem = (w: Workout): WorkoutItem => ({
  id: w.id,
  type: w.type,
  durationMin: w.durationMin,
  distanceM: w.distanceM,
  calories: w.calories,
  caloriesEstimated: w.caloriesEstimated,
  date: w.performedOn,
  note: w.note,
});

export async function addWorkout(
  db: Db,
  userId: string,
  input: WorkoutInput,
  opts: { today: DateString; via?: Via },
) {
  const data = workoutSchema.parse(input);
  if (data.date > opts.today) throw new FitnessError("invalid");
  const weight = data.calories === null ? await weightOn(db, userId, data.date) : null;
  const calories =
    data.calories ?? estimateCalories(data.type, data.durationMin, weight?.weightG ?? null);
  const [row] = await db
    .insert(workouts)
    .values({
      userId,
      type: data.type,
      durationMin: data.durationMin,
      distanceM: data.distanceKm === null ? null : kmToMeters(data.distanceKm),
      calories,
      caloriesEstimated: data.calories === null,
      performedOn: data.date,
      note: data.note || null,
      createdVia: opts.via ?? "manual",
    })
    .returning();
  return toItem(row!);
}

export async function updateWorkout(
  db: Db,
  userId: string,
  id: string,
  input: WorkoutInput,
  today: DateString,
) {
  const data = workoutSchema.parse(input);
  if (data.date > today) throw new FitnessError("invalid");
  const weight = data.calories === null ? await weightOn(db, userId, data.date) : null;
  const [row] = await db
    .update(workouts)
    .set({
      type: data.type,
      durationMin: data.durationMin,
      distanceM: data.distanceKm === null ? null : kmToMeters(data.distanceKm),
      calories:
        data.calories ?? estimateCalories(data.type, data.durationMin, weight?.weightG ?? null),
      caloriesEstimated: data.calories === null,
      performedOn: data.date,
      note: data.note || null,
    })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId), isNull(workouts.deletedAt)))
    .returning();
  if (!row) throw new FitnessError("not_found");
  return toItem(row);
}

export async function deleteWorkout(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(workouts)
    .set({ deletedAt: new Date() })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId), isNull(workouts.deletedAt)))
    .returning({ id: workouts.id });
  if (!row) throw new FitnessError("not_found");
}

export async function restoreWorkout(db: Db, userId: string, id: string) {
  await db
    .update(workouts)
    .set({ deletedAt: null })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)));
}

export async function listWorkouts(
  db: Db,
  userId: string,
  opts: { from?: DateString; to?: DateString; limit?: number } = {},
): Promise<WorkoutItem[]> {
  const rows = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        isNull(workouts.deletedAt),
        opts.from ? gte(workouts.performedOn, opts.from) : undefined,
        opts.to ? lte(workouts.performedOn, opts.to) : undefined,
      ),
    )
    .orderBy(desc(workouts.performedOn), desc(workouts.createdAt))
    .limit(opts.limit ?? 200);
  return rows.map(toItem);
}

export type WorkoutSummary = {
  from: DateString;
  to: DateString;
  count: number;
  minutes: number;
  calories: number;
  distanceM: number;
  activeDays: number;
  byType: { type: WorkoutType; count: number; minutes: number }[];
  days: { date: DateString; minutes: number; count: number }[];
};

export async function workoutSummary(
  db: Db,
  userId: string,
  from: DateString,
  to: DateString,
): Promise<WorkoutSummary> {
  const items = await listWorkouts(db, userId, { from, to, limit: 1000 });
  const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => {
    const date = addDays(from, i);
    const list = items.filter((w) => w.date === date);
    return { date, minutes: list.reduce((s, w) => s + w.durationMin, 0), count: list.length };
  });
  const types = new Map<WorkoutType, { type: WorkoutType; count: number; minutes: number }>();
  for (const w of items) {
    const t = types.get(w.type) ?? { type: w.type, count: 0, minutes: 0 };
    t.count += 1;
    t.minutes += w.durationMin;
    types.set(w.type, t);
  }
  return {
    from,
    to,
    count: items.length,
    minutes: items.reduce((s, w) => s + w.durationMin, 0),
    calories: items.reduce((s, w) => s + (w.calories ?? 0), 0),
    distanceM: items.reduce((s, w) => s + (w.distanceM ?? 0), 0),
    activeDays: days.filter((d) => d.count > 0).length,
    byType: [...types.values()].sort((a, b) => b.minutes - a.minutes),
    days,
  };
}

/** Pazartesi başlayan hafta. */
export function weekOf(day: DateString) {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  const start = addDays(day, -((dow + 6) % 7));
  return { start, end: addDays(start, 6) };
}

/* ---------------------------------------------------------------- Hedef */

export type GoalRow = {
  id: string;
  startG: number;
  targetG: number;
  startDate: DateString;
  targetDate: DateString | null;
};

export async function getActiveGoal(db: Db, userId: string): Promise<GoalRow | null> {
  const [row] = await db
    .select({
      id: fitnessGoals.id,
      startG: fitnessGoals.startValue,
      targetG: fitnessGoals.targetValue,
      startDate: fitnessGoals.startDate,
      targetDate: fitnessGoals.targetDate,
    })
    .from(fitnessGoals)
    .where(and(eq(fitnessGoals.userId, userId), eq(fitnessGoals.status, "active")))
    .orderBy(desc(fitnessGoals.createdAt))
    .limit(1);
  return row ?? null;
}

/** Yeni hedef öncekinin yerine geçer (önceki arşivlenir); geri almak için iki id döner. */
export async function setWeightGoal(
  db: Db,
  userId: string,
  input: GoalInput,
  opts: { today: DateString; via?: Via },
) {
  const data = goalSchema.parse(input);
  const startG =
    data.startKg !== null
      ? kgToGrams(data.startKg)
      : (await weightOn(db, userId, opts.today))?.weightG;
  if (!startG) throw new FitnessError("no_weight");
  const targetG = kgToGrams(data.targetKg);
  if (Math.abs(startG - targetG) < 100) throw new FitnessError("invalid");
  if (data.targetDate && data.targetDate <= opts.today) throw new FitnessError("invalid");
  const previous = await getActiveGoal(db, userId);
  if (previous) {
    await db
      .update(fitnessGoals)
      .set({ status: "archived" })
      .where(eq(fitnessGoals.id, previous.id));
  }
  const [row] = await db
    .insert(fitnessGoals)
    .values({
      userId,
      kind: "weight",
      startValue: startG,
      targetValue: targetG,
      startDate: opts.today,
      targetDate: data.targetDate,
      createdVia: opts.via ?? "manual",
    })
    .returning({ id: fitnessGoals.id });
  return { id: row!.id, previousId: previous?.id ?? null };
}

/** setWeightGoal'ı geri alır: yeni hedef silinir, önceki yeniden etkinleşir. */
export async function revertGoal(
  db: Db,
  userId: string,
  undo: { id: string; previousId: string | null },
) {
  await db
    .delete(fitnessGoals)
    .where(and(eq(fitnessGoals.id, undo.id), eq(fitnessGoals.userId, userId)));
  if (undo.previousId) {
    await db
      .update(fitnessGoals)
      .set({ status: "active" })
      .where(and(eq(fitnessGoals.id, undo.previousId), eq(fitnessGoals.userId, userId)));
  }
}

export async function removeGoal(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(fitnessGoals)
    .set({ status: "archived" })
    .where(
      and(
        eq(fitnessGoals.id, id),
        eq(fitnessGoals.userId, userId),
        eq(fitnessGoals.status, "active"),
      ),
    )
    .returning({ id: fitnessGoals.id });
  if (!row) throw new FitnessError("not_found");
}

export async function restoreGoal(db: Db, userId: string, id: string) {
  await db
    .update(fitnessGoals)
    .set({ status: "archived" })
    .where(
      and(
        eq(fitnessGoals.userId, userId),
        eq(fitnessGoals.status, "active"),
        ne(fitnessGoals.id, id),
      ),
    );
  await db
    .update(fitnessGoals)
    .set({ status: "active" })
    .where(and(eq(fitnessGoals.id, id), eq(fitnessGoals.userId, userId)));
}

/* ------------------------------------------------------------- Analizler */

export type WeightHistory = {
  latest: WeightEntry | null;
  previous: WeightEntry | null;
  /** Son ölçüm − bir önceki. */
  deltaG: number | null;
  /** Son ölçüm − 30 gün önceki (ya da bu aralıktaki ilk) ölçüm. */
  last30: { fromDate: DateString; deltaG: number } | null;
  /** Son ölçüm − bu ayın başındaki ölçüm. */
  thisMonth: { fromDate: DateString; deltaG: number } | null;
  /** Kayıtların ilkinden bu yana. */
  total: { fromDate: DateString; deltaG: number } | null;
  points: WeightEntry[];
};

export async function weightHistory(
  db: Db,
  userId: string,
  today: DateString,
  days = 90,
): Promise<WeightHistory> {
  const all = await listWeights(db, userId, { to: today });
  const latest = all.at(-1) ?? null;
  const previous = all.at(-2) ?? null;
  const since = (from: DateString) => {
    if (!latest) return null;
    // Aralığın başındaki ölçüm: başlangıçtan önceki son kayıt, yoksa aralıktaki ilk kayıt.
    const before = [...all].reverse().find((w) => w.date <= from);
    const base = before ?? all.find((w) => w.date > from && w.date < latest.date);
    if (!base || base.date === latest.date) return null;
    return { fromDate: base.date, deltaG: latest.weightG - base.weightG };
  };
  const first = all[0];
  return {
    latest,
    previous,
    deltaG: latest && previous ? latest.weightG - previous.weightG : null,
    last30: since(addDays(today, -30)),
    thisMonth: since(monthOf(today).start),
    total:
      latest && first && first.date !== latest.date
        ? { fromDate: first.date, deltaG: latest.weightG - first.weightG }
        : null,
    points: all.filter((w) => w.date >= addDays(today, -days)),
  };
}

export type GoalView = GoalRow & {
  currentG: number;
  progress: GoalProgress;
  etaDays: number | null;
  safety: GoalSafety;
};

export type BmiView = BmiAssessment & { heightMm: number; weightG: number; measuredOn: DateString };

export type FitnessDashboard = {
  profile: (Profile & { age: number | null }) | null;
  bmi: BmiView | null;
  weight: WeightHistory;
  week: WorkoutSummary;
  goal: GoalView | null;
  recentWorkouts: WorkoutItem[];
  isEmpty: boolean;
};

export async function getBmi(db: Db, userId: string, today: DateString): Promise<BmiView | null> {
  const [profile, latest] = await Promise.all([
    getProfile(db, userId),
    weightOn(db, userId, today),
  ]);
  if (!profile?.heightMm || !latest) return null;
  const age = ageFromBirthYear(profile.birthYear, today);
  return {
    ...assessBmi(latest.weightG, profile.heightMm, age),
    heightMm: profile.heightMm,
    weightG: latest.weightG,
    measuredOn: latest.date,
  };
}

export async function getGoalView(
  db: Db,
  userId: string,
  today: DateString,
): Promise<GoalView | null> {
  const [goal, profile, history] = await Promise.all([
    getActiveGoal(db, userId),
    getProfile(db, userId),
    listWeights(db, userId, { from: addDays(today, -60), to: today }),
  ]);
  if (!goal) return null;
  const currentG = history.at(-1)?.weightG ?? goal.startG;
  const progress = goalProgress(goal.startG, currentG, goal.targetG);
  return {
    ...goal,
    currentG,
    progress,
    etaDays: etaDays(progress, weightTrend(history, today)),
    safety: goalSafety(currentG, goal.targetG, goal.targetDate, today, profile?.heightMm ?? null),
  };
}

export async function getFitnessDashboard(
  db: Db,
  userId: string,
  today: DateString,
): Promise<FitnessDashboard> {
  const week = weekOf(today);
  const [profile, bmi, weight, summary, goal, recentWorkouts] = await Promise.all([
    getProfile(db, userId),
    getBmi(db, userId, today),
    weightHistory(db, userId, today),
    workoutSummary(db, userId, week.start, week.end),
    getGoalView(db, userId, today),
    listWorkouts(db, userId, { to: today, limit: 6 }),
  ]);
  return {
    profile: profile ? { ...profile, age: ageFromBirthYear(profile.birthYear, today) } : null,
    bmi,
    weight,
    week: summary,
    goal,
    recentWorkouts,
    isEmpty: !profile && !weight.latest && recentWorkouts.length === 0,
  };
}
