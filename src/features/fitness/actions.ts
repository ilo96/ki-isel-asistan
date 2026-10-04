"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dayIn, DEFAULT_TIMEZONE, type DateString } from "@/lib/dates";
import { isModuleKey, MODULES, type ModuleKey } from "@/lib/modules";
import {
  fitnessSettingsSchema,
  goalSchema,
  measurementSchema,
  workoutSchema,
  type GoalInput,
  type MeasurementInput,
  LIMITS,
  SEXES,
  type WorkoutInput,
} from "@/lib/validation/fitness";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import type { Db } from "@/server/db/client";
import {
  addWorkout,
  deleteWeight,
  deleteWorkout,
  FitnessError,
  removeGoal,
  restoreGoal,
  restoreWeight,
  restoreWorkout,
  revertMeasurement,
  saveMeasurement,
  setWeightGoal,
  updateWorkout,
  type MeasurementUndo,
} from "@/server/services/fitness";
import { getModuleState, setModuleState } from "@/server/services/modules";

/*
 * Spor & Sağlık ekranının server action'ları. Kullanıcı oturumdan gelir; girdi aynı Zod
 * şemasıyla yeniden doğrulanır. Sağlık verisi loglara yazılmaz: hatada yalnızca hata adı.
 */

export type FitnessActionError =
  "unauthorized" | "invalid" | "unknown" | "disabled" | FitnessError["code"];
type Result<T> = { ok: true; data: T } | { ok: false; error: FitnessActionError };
type Ctx = { db: Db; userId: string; today: DateString };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = { ok: false as const, error: "invalid" as const };

async function run<T>(
  label: string,
  fn: (ctx: Ctx) => Promise<T>,
  opts: { requireEnabled?: boolean } = {},
): Promise<Result<T>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  try {
    const db = await getDb();
    const ctx = {
      db,
      userId: session.user.id,
      today: dayIn(new Date(), session.user.timezone ?? DEFAULT_TIMEZONE),
    };
    if (
      opts.requireEnabled !== false &&
      !(await getModuleState(db, ctx.userId, "fitness")).enabled
    ) {
      return { ok: false, error: "disabled" };
    }
    const data = await fn(ctx);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof FitnessError) return { ok: false, error: error.code };
    console.error(label, error instanceof Error ? error.name : "error");
    return { ok: false, error: "unknown" };
  }
}

export async function saveMeasurementAction(input: MeasurementInput) {
  if (!measurementSchema.safeParse(input).success) return invalid;
  return run(
    "Ölçüm kaydedilemedi",
    async ({ db, userId, today }) => (await saveMeasurement(db, userId, input, { today })).undo,
  );
}

/** İstemciden dönen geri alma verisi de doğrulanır; yalnızca kullanıcının kendi satırına yazılır. */
const undoSchema = z.object({
  profile: z
    .object({
      heightMm: z
        .number()
        .int()
        .min(LIMITS.heightCm.min * 10)
        .max(LIMITS.heightCm.max * 10)
        .nullable(),
      birthYear: z.number().int().min(1900).max(2200).nullable(),
      sex: z.enum(SEXES).nullable(),
    })
    .nullable()
    .optional(),
  weight: z
    .object({
      date: z.iso.date(),
      previousG: z
        .number()
        .int()
        .min(LIMITS.weightKg.min * 1000)
        .max(LIMITS.weightKg.max * 1000)
        .nullable(),
    })
    .optional(),
});

export async function undoMeasurementAction(undo: MeasurementUndo) {
  if (!undoSchema.safeParse(undo).success) return invalid;
  return run("Ölçüm geri alınamadı", ({ db, userId }) => revertMeasurement(db, userId, undo));
}

export async function deleteWeightAction(id: string) {
  if (!uuid.test(id)) return invalid;
  return run("Kilo kaydı silinemedi", ({ db, userId }) => deleteWeight(db, userId, id));
}

export async function restoreWeightAction(row: { date: DateString; weightG: number }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isInteger(row.weightG) || row.weightG <= 0)
    return invalid;
  return run("Kilo kaydı geri alınamadı", ({ db, userId }) => restoreWeight(db, userId, row));
}

export async function saveWorkoutAction(id: string | null, input: WorkoutInput) {
  if (!workoutSchema.safeParse(input).success || (id !== null && !uuid.test(id))) return invalid;
  return run("Aktivite kaydedilemedi", async ({ db, userId, today }) => {
    const item = id
      ? await updateWorkout(db, userId, id, input, today)
      : await addWorkout(db, userId, input, { today });
    return { id: item.id };
  });
}

export async function deleteWorkoutAction(id: string) {
  if (!uuid.test(id)) return invalid;
  return run("Aktivite silinemedi", ({ db, userId }) => deleteWorkout(db, userId, id));
}

export async function restoreWorkoutAction(id: string) {
  if (!uuid.test(id)) return invalid;
  return run("Aktivite geri alınamadı", ({ db, userId }) => restoreWorkout(db, userId, id));
}

export async function saveGoalAction(input: GoalInput) {
  if (!goalSchema.safeParse(input).success) return invalid;
  return run("Hedef kaydedilemedi", ({ db, userId, today }) =>
    setWeightGoal(db, userId, input, { today }),
  );
}

export async function removeGoalAction(id: string) {
  if (!uuid.test(id)) return invalid;
  return run("Hedef kaldırılamadı", ({ db, userId }) => removeGoal(db, userId, id));
}

export async function restoreGoalAction(id: string) {
  if (!uuid.test(id)) return invalid;
  return run("Hedef geri alınamadı", ({ db, userId }) => restoreGoal(db, userId, id));
}

/** Eklentiyi açar/kapatır ve bildirim tercihlerini kaydeder. Kapalıyken de çalışır. */
export async function saveModuleAction(
  key: ModuleKey,
  patch: { enabled?: boolean; settings?: Record<string, unknown> },
) {
  if (!isModuleKey(key)) return invalid;
  if (patch.enabled !== undefined && typeof patch.enabled !== "boolean") return invalid;
  let settings: Record<string, unknown> | undefined;
  if (patch.settings) {
    // Her eklentinin kendi ayar şeması var; bilinmeyen alanlar yazılmaz.
    const schema = { fitness: fitnessSettingsSchema }[key];
    const parsed = schema.partial().safeParse(patch.settings);
    if (!parsed.success) return invalid;
    settings = Object.fromEntries(
      Object.entries(parsed.data).filter(([k]) => k in MODULES[key].defaultSettings),
    );
  }
  return run(
    "Eklenti ayarı kaydedilemedi",
    ({ db, userId }) => setModuleState(db, userId, key, { enabled: patch.enabled, settings }),
    { requireEnabled: false },
  );
}
