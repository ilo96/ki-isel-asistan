import type { BmiCategory } from "@/lib/fitness/bmi";

/**
 * Kategori renkleri: mavi, yeşil, turuncu, kırmızı. Renk tek başına anlam taşımaz; metin hep yanında.
 * "use client" dosyasında durmamalı: sunucu bileşeni (ana sayfa kartı) istemci modülünden bir
 * nesne alırsa nesne yerine istemci referansı gelir ve sayfa çöker.
 */
export const BMI_TONE: Record<BmiCategory, { bar: string; text: string; soft: string }> = {
  underweight: { bar: "bg-cat-4", text: "text-cat-4", soft: "bg-cat-4/12" },
  normal: { bar: "bg-positive", text: "text-positive", soft: "bg-positive-soft" },
  overweight: { bar: "bg-warning", text: "text-warning", soft: "bg-warning-soft" },
  obese: { bar: "bg-negative", text: "text-negative", soft: "bg-negative-soft" },
};
