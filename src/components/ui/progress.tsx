"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/motion";

type ProgressProps = {
  /** 0–1 arası oran; 1'in üstü limit aşımı demektir. */
  value: number;
  label: string;
  /** budget: %80'de uyarı, %100'de aşım rengi. goal: dolunca başarı rengi. */
  kind?: "budget" | "goal";
  className?: string;
};

/** İlerleme çubuğu: bütçede dolmak kötü, hedefte iyi haberdir. */
export function Progress({ value, label, kind = "budget", className }: ProgressProps) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(value, 1));
  const tone =
    kind === "goal"
      ? value >= 1
        ? "bg-positive"
        : "bg-accent"
      : value >= 1
        ? "bg-negative"
        : value >= 0.8
          ? "bg-warning"
          : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <motion.div
        className={cn("h-full rounded-full", tone)}
        initial={{ width: reduce ? `${clamped * 100}%` : 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: reduce ? 0 : duration.count, ease: "easeOut" }}
      />
    </div>
  );
}
