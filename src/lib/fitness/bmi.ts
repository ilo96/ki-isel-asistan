/*
 * Vücut Kitle İndeksi: kilo (kg) / boy (m)². Değer bir ondalığa yuvarlanır ve kategori
 * yuvarlanmış değere göre belirlenir (24,95 → 25,0 → Fazla kilolu), böylece ekrandaki sayı
 * ile kategori hep tutarlıdır. Kategoriler yalnızca yetişkinler (18+) için geçerlidir;
 * yaş bilinmiyorsa yetişkin varsayılır ve arayüz bunu belirtir.
 */

export const BMI_CATEGORIES = ["underweight", "normal", "overweight", "obese"] as const;
export type BmiCategory = (typeof BMI_CATEGORIES)[number];

export const ADULT_AGE = 18;

/** Kategori sınırları (alt sınır dahil). */
export const BMI_BANDS: readonly { category: BmiCategory; from: number; to: number }[] = [
  { category: "underweight", from: 0, to: 18.5 },
  { category: "normal", from: 18.5, to: 25 },
  { category: "overweight", from: 25, to: 30 },
  { category: "obese", from: 30, to: Infinity },
];

/** Göstergenin çizildiği aralık; dışındaki değerler uçlara yapışır. */
export const BMI_SCALE = { min: 15, max: 40 } as const;

export const roundBmi = (value: number) => Math.round(value * 10) / 10;

export function computeBmi(weightG: number, heightMm: number): number {
  if (weightG <= 0 || heightMm <= 0) throw new RangeError("Boy ve kilo pozitif olmalı");
  const m = heightMm / 1000;
  return weightG / 1000 / (m * m);
}

export function bmiCategory(bmi: number): BmiCategory {
  const v = roundBmi(bmi);
  if (v < 18.5) return "underweight";
  if (v < 25) return "normal";
  if (v < 30) return "overweight";
  return "obese";
}

/** Göstergedeki konum (0–1). */
export function bmiPosition(bmi: number) {
  const { min, max } = BMI_SCALE;
  return Math.min(1, Math.max(0, (bmi - min) / (max - min)));
}

export type BmiAssessment = {
  value: number;
  /** 18 yaş altında yetişkin sınıflaması uygulanmaz: null. */
  category: BmiCategory | null;
  ageKnown: boolean;
};

export function assessBmi(weightG: number, heightMm: number, age: number | null): BmiAssessment {
  const value = roundBmi(computeBmi(weightG, heightMm));
  const child = age !== null && age < ADULT_AGE;
  return { value, category: child ? null : bmiCategory(value), ageKnown: age !== null };
}

/** Boya göre "Normal" aralığa düşen kilolar (18,5–24,9); bilgi amaçlı. */
export function normalWeightRange(heightMm: number) {
  const m2 = (heightMm / 1000) ** 2;
  return { minG: Math.ceil(18.5 * m2 * 1000), maxG: Math.floor(24.9 * m2 * 1000) };
}

export const ageFromBirthYear = (birthYear: number | null, today: string) =>
  birthYear === null ? null : Number(today.slice(0, 4)) - birthYear;

export const BMI_LABEL: Record<BmiCategory, string> = {
  underweight: "Zayıf",
  normal: "Normal",
  overweight: "Fazla kilolu",
  obese: "Obezite",
};

export const formatBmi = (value: number) =>
  value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
