"use client";

import { motion, useReducedMotion } from "motion/react";
import { BMI_BANDS, BMI_SCALE, bmiPosition, type BmiCategory } from "@/lib/fitness/bmi";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";

/** Kategori renkleri: mavi, yeşil, turuncu, kırmızı. Renk tek başına anlam taşımaz; metin hep yanında. */
export const BMI_TONE: Record<BmiCategory, { bar: string; text: string; soft: string }> = {
  underweight: { bar: "bg-cat-4", text: "text-cat-4", soft: "bg-cat-4/12" },
  normal: { bar: "bg-positive", text: "text-positive", soft: "bg-positive-soft" },
  overweight: { bar: "bg-warning", text: "text-warning", soft: "bg-warning-soft" },
  obese: { bar: "bg-negative", text: "text-negative", soft: "bg-negative-soft" },
};

const span = BMI_SCALE.max - BMI_SCALE.min;
const width = (from: number, to: number) =>
  ((Math.min(to, BMI_SCALE.max) - Math.max(from, BMI_SCALE.min)) / span) * 100;

/** 15–40 aralığında dört renkli şerit ve değeri gösteren işaret. Ekran okuyucu metni kart verir. */
export function BmiGauge({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const left = `${bmiPosition(value) * 100}%`;
  return (
    <div className={cn("relative pt-3", className)} aria-hidden>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {BMI_BANDS.map((b) => (
          <span
            key={b.category}
            className={cn("h-full opacity-80", BMI_TONE[b.category].bar)}
            style={{ width: `${width(b.from, b.to)}%` }}
          />
        ))}
      </div>
      <motion.span
        className="absolute top-0 size-0 -translate-x-1/2"
        initial={{ left: reduce ? left : "0%" }}
        animate={{ left }}
        transition={{ duration: reduce ? 0 : duration.count, ease }}
      >
        <span className="absolute top-0.5 left-1/2 block h-5 w-1.5 -translate-x-1/2 rounded-full border-2 border-surface bg-text shadow-card" />
      </motion.span>
      <div className="relative mt-1.5 h-4 text-caption text-muted tabular-nums">
        {[18.5, 25, 30].map((n) => (
          <span
            key={n}
            className="absolute -translate-x-1/2"
            style={{ left: `${((n - BMI_SCALE.min) / span) * 100}%` }}
          >
            {String(n).replace(".", ",")}
          </span>
        ))}
      </div>
    </div>
  );
}
