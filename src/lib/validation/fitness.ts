import { z } from "zod";
import { WORKOUT_TYPES } from "@/lib/fitness/activities";
import { parseLocaleNumber } from "@/lib/fitness/number";

/*
 * Spor & Sağlık girdileri. Sınırlar iki katmanlı: "hard" dışı reddedilir (gerçek dışı),
 * "typical" dışı kabul edilir ama kullanıcı uyarılır (yanlış yazılmış olabilir).
 * Hata ve uyarılar anahtar olarak döner; metinler messages/tr.json → fitness.errors.
 */

export const LIMITS = {
  heightCm: { min: 50, max: 272, typicalMin: 130, typicalMax: 220 },
  weightKg: { min: 20, max: 400, typicalMin: 35, typicalMax: 200 },
  age: { min: 2, max: 120 },
  durationMin: { min: 1, max: 1440, typicalMax: 300 },
  distanceKm: { min: 0.01, max: 500 },
  calories: { min: 1, max: 10000 },
} as const;

export const SEXES = ["female", "male", "other"] as const;
export type Sex = (typeof SEXES)[number];

const isoDate = z.iso.date();

export const measurementSchema = z
  .object({
    heightCm: z.number().min(LIMITS.heightCm.min).max(LIMITS.heightCm.max).nullable(),
    weightKg: z.number().min(LIMITS.weightKg.min).max(LIMITS.weightKg.max).nullable(),
    age: z.number().int().min(LIMITS.age.min).max(LIMITS.age.max).nullable(),
    sex: z.enum(SEXES).nullable(),
    date: isoDate,
  })
  .refine((v) => v.heightCm !== null || v.weightKg !== null || v.age !== null || v.sex !== null, {
    message: "empty",
  });
export type MeasurementInput = z.infer<typeof measurementSchema>;

export const workoutSchema = z.object({
  type: z.enum(WORKOUT_TYPES),
  durationMin: z.number().int().min(LIMITS.durationMin.min).max(LIMITS.durationMin.max),
  distanceKm: z.number().min(LIMITS.distanceKm.min).max(LIMITS.distanceKm.max).nullable(),
  calories: z.number().int().min(LIMITS.calories.min).max(LIMITS.calories.max).nullable(),
  date: isoDate,
  note: z.string().trim().max(200),
});
export type WorkoutInput = z.infer<typeof workoutSchema>;

export const goalSchema = z.object({
  /** Boşsa son ölçüm başlangıç kabul edilir. */
  startKg: z.number().min(LIMITS.weightKg.min).max(LIMITS.weightKg.max).nullable(),
  targetKg: z.number().min(LIMITS.weightKg.min).max(LIMITS.weightKg.max),
  targetDate: isoDate.nullable(),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const fitnessSettingsSchema = z.object({
  notifyWeighIn: z.boolean(),
  notifyWorkout: z.boolean(),
  notifyGoal: z.boolean(),
});
export type FitnessSettings = z.infer<typeof fitnessSettingsSchema>;

/** Varsayılanlar seyrek: tartı ve hedef haftada en fazla bir kez, spor hatırlatması kapalı. */
export const DEFAULT_FITNESS_SETTINGS: FitnessSettings = {
  notifyWeighIn: true,
  notifyWorkout: false,
  notifyGoal: true,
};

/* ------------------------------------------------- Form metninden doğrulama */

export type FieldError =
  | "heightRequired"
  | "heightInvalid"
  | "heightRange"
  | "weightRequired"
  | "weightInvalid"
  | "weightRange"
  | "ageInvalid"
  | "durationRequired"
  | "durationInvalid"
  | "distanceInvalid"
  | "caloriesInvalid"
  | "dateInvalid"
  | "dateFuture"
  | "targetRequired"
  | "targetSame"
  | "targetDatePast"
  | "empty";

export type FieldWarning = "heightUnusual" | "weightUnusual" | "durationLong" | "heightInMeters";

type Parsed<T> =
  | { ok: true; value: T; warnings: FieldWarning[] }
  | { ok: false; errors: Partial<Record<string, FieldError>> };

/** Boş → undefined, sayı değil → NaN, aksi halde değer. */
function num(raw: string | undefined) {
  if (raw === undefined || raw.trim() === "") return undefined;
  return parseLocaleNumber(raw) ?? Number.NaN;
}

/**
 * Boy cm beklenir; 1,0–2,72 arası yazıldıysa metre sanılıp cm'ye çevrilir ve uyarı eklenir.
 */
export function readHeight(raw: string | undefined, warnings: FieldWarning[]) {
  let v = num(raw);
  if (v === undefined || Number.isNaN(v)) return v;
  if (v >= 1 && v <= 2.72) {
    v = Math.round(v * 1000) / 10;
    warnings.push("heightInMeters");
  }
  return v;
}

export function parseMeasurementForm(
  raw: { height?: string; weight?: string; age?: string; sex?: Sex | ""; date: string },
  opts: { requireHeight: boolean; requireWeight: boolean; today: string },
): Parsed<MeasurementInput> {
  const errors: Partial<Record<string, FieldError>> = {};
  const warnings: FieldWarning[] = [];
  const height = readHeight(raw.height, warnings);
  const weight = num(raw.weight);
  const age = num(raw.age);

  if (height === undefined) {
    if (opts.requireHeight) errors.height = "heightRequired";
  } else if (Number.isNaN(height) || height <= 0) errors.height = "heightInvalid";
  else if (height < LIMITS.heightCm.min || height > LIMITS.heightCm.max)
    errors.height = "heightRange";
  else if (height < LIMITS.heightCm.typicalMin || height > LIMITS.heightCm.typicalMax)
    warnings.push("heightUnusual");

  if (weight === undefined) {
    if (opts.requireWeight) errors.weight = "weightRequired";
  } else if (Number.isNaN(weight) || weight <= 0) errors.weight = "weightInvalid";
  else if (weight < LIMITS.weightKg.min || weight > LIMITS.weightKg.max)
    errors.weight = "weightRange";
  else if (weight < LIMITS.weightKg.typicalMin || weight > LIMITS.weightKg.typicalMax)
    warnings.push("weightUnusual");

  if (
    age !== undefined &&
    (Number.isNaN(age) || !Number.isInteger(age) || age < LIMITS.age.min || age > LIMITS.age.max)
  ) {
    errors.age = "ageInvalid";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) errors.date = "dateInvalid";
  else if (raw.date > opts.today) errors.date = "dateFuture";

  if (Object.keys(errors).length) return { ok: false, errors };
  const value = {
    heightCm: height ?? null,
    weightKg: weight ?? null,
    age: age ?? null,
    sex: raw.sex || null,
    date: raw.date,
  };
  const parsed = measurementSchema.safeParse(value);
  if (!parsed.success) return { ok: false, errors: { form: "empty" } };
  return { ok: true, value: parsed.data, warnings };
}

export function parseWorkoutForm(
  raw: {
    type: string;
    duration: string;
    distance?: string;
    calories?: string;
    date: string;
    note?: string;
  },
  today: string,
): Parsed<WorkoutInput> {
  const errors: Partial<Record<string, FieldError>> = {};
  const warnings: FieldWarning[] = [];
  const duration = num(raw.duration);
  const distance = num(raw.distance);
  const calories = num(raw.calories);

  if (duration === undefined) errors.duration = "durationRequired";
  else if (Number.isNaN(duration) || duration <= 0 || duration > LIMITS.durationMin.max)
    errors.duration = "durationInvalid";
  else if (duration > LIMITS.durationMin.typicalMax) warnings.push("durationLong");
  if (
    distance !== undefined &&
    (Number.isNaN(distance) || distance < LIMITS.distanceKm.min || distance > LIMITS.distanceKm.max)
  ) {
    errors.distance = "distanceInvalid";
  }
  if (
    calories !== undefined &&
    (Number.isNaN(calories) || calories < LIMITS.calories.min || calories > LIMITS.calories.max)
  ) {
    errors.calories = "caloriesInvalid";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) errors.date = "dateInvalid";
  else if (raw.date > today) errors.date = "dateFuture";
  if (Object.keys(errors).length) return { ok: false, errors };

  const parsed = workoutSchema.safeParse({
    type: raw.type,
    durationMin: Math.round(duration!),
    distanceKm: distance ?? null,
    calories: calories === undefined ? null : Math.round(calories),
    date: raw.date,
    note: raw.note ?? "",
  });
  if (!parsed.success) return { ok: false, errors: { form: "empty" } };
  return { ok: true, value: parsed.data, warnings };
}

export function parseGoalForm(
  raw: { start?: string; target: string; targetDate?: string },
  today: string,
): Parsed<GoalInput> {
  const errors: Partial<Record<string, FieldError>> = {};
  const warnings: FieldWarning[] = [];
  const start = num(raw.start);
  const target = num(raw.target);
  const check = (v: number | undefined, key: string, required: boolean) => {
    if (v === undefined) {
      if (required) errors[key] = "targetRequired";
    } else if (Number.isNaN(v) || v <= 0) errors[key] = "weightInvalid";
    else if (v < LIMITS.weightKg.min || v > LIMITS.weightKg.max) errors[key] = "weightRange";
  };
  check(start, "start", false);
  check(target, "target", true);
  if (
    !errors.start &&
    !errors.target &&
    start !== undefined &&
    target !== undefined &&
    Math.abs(start - target) < 0.1
  ) {
    errors.target = "targetSame";
  }
  const date = raw.targetDate?.trim() || null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.targetDate = "dateInvalid";
  else if (date && date <= today) errors.targetDate = "targetDatePast";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { startKg: start ?? null, targetKg: target!, targetDate: date },
    warnings,
  };
}
