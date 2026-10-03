import type { DateString } from "@/lib/dates";
import type { FitnessSettings, Sex } from "@/lib/validation/fitness";
import type {
  BmiView,
  GoalView,
  WeightEntry,
  WeightHistory,
  WorkoutItem,
  WorkoutSummary,
} from "@/server/services/fitness";

/** Spor ekranının sunucudan istemciye geçen verisi (düz JSON). */
export type FitnessPageData = {
  today: DateString;
  profile: { heightMm: number | null; age: number | null; sex: Sex | null } | null;
  bmi: BmiView | null;
  weight: WeightHistory;
  week: WorkoutSummary;
  goal: GoalView | null;
  workouts: WorkoutItem[];
  weights: WeightEntry[];
  settings: FitnessSettings;
};
