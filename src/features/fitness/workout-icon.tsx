import {
  Bike,
  Dumbbell,
  Footprints,
  PersonStanding,
  Sparkles,
  Trophy,
  Volleyball,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { WorkoutType } from "@/lib/fitness/activities";

const ICONS: Record<WorkoutType, LucideIcon> = {
  walking: Footprints,
  running: Zap,
  cycling: Bike,
  swimming: Waves,
  fitness: Dumbbell,
  strength: Dumbbell,
  football: Trophy,
  basketball: Volleyball,
  yoga: PersonStanding,
  other: Sparkles,
};

export function WorkoutIcon({ type, className }: { type: WorkoutType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={className} aria-hidden />;
}
