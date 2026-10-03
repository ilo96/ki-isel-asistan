/*
 * Aktivite türleri ve tahmini kalori. Kalori = MET × kilo (kg) × süre (saat); MET değerleri
 * Compendium of Physical Activities'teki orta yoğunluk karşılıklarıdır. Sonuç bir tahmindir,
 * arayüzde her zaman "tahmini" diye gösterilir. Kilo bilinmiyorsa 70 kg varsayılır.
 */

export const WORKOUT_TYPES = [
  "walking",
  "running",
  "cycling",
  "swimming",
  "fitness",
  "strength",
  "football",
  "basketball",
  "yoga",
  "other",
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const MET: Record<WorkoutType, number> = {
  walking: 3.5,
  running: 9.8,
  cycling: 7.5,
  swimming: 7,
  fitness: 5.5,
  strength: 5,
  football: 7,
  basketball: 6.5,
  yoga: 2.5,
  other: 4,
};

/** Mesafe alanının anlamlı olduğu türler. */
export const DISTANCE_TYPES: readonly WorkoutType[] = ["walking", "running", "cycling", "swimming"];

export const WORKOUT_LABEL: Record<WorkoutType, string> = {
  walking: "Yürüyüş",
  running: "Koşu",
  cycling: "Bisiklet",
  swimming: "Yüzme",
  fitness: "Fitness",
  strength: "Ağırlık antrenmanı",
  football: "Futbol",
  basketball: "Basketbol",
  yoga: "Yoga",
  other: "Diğer",
};

export const DEFAULT_WEIGHT_G = 70_000;

export function estimateCalories(type: WorkoutType, durationMin: number, weightG: number | null) {
  const kg = (weightG ?? DEFAULT_WEIGHT_G) / 1000;
  return Math.round(MET[type] * kg * (durationMin / 60));
}
