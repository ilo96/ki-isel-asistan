/*
 * Ölçüler veritabanında tam sayı ve metrik tutulur (boy mm, kilo gram, mesafe metre).
 * Arayüz şimdilik yalnızca metrik gösterir; imperial için çeviriler ve biçimlendiriciler
 * burada hazır, böylece ileride yalnızca kullanıcının unit_system tercihi değişir.
 */

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

const LB_IN_G = 453.59237;
const IN_IN_MM = 25.4;

export const kgToGrams = (kg: number) => Math.round(kg * 1000);
export const gramsToKg = (g: number) => g / 1000;
export const cmToMm = (cm: number) => Math.round(cm * 10);
export const mmToCm = (mm: number) => mm / 10;
export const kmToMeters = (km: number) => Math.round(km * 1000);
export const metersToKm = (m: number) => m / 1000;
export const gramsToLb = (g: number) => g / LB_IN_G;
export const mmToInches = (mm: number) => mm / IN_IN_MM;

const one = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const two = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

/** "80,5 kg" (metrik) ya da "177,5 lb". */
export function formatWeight(g: number, system: UnitSystem = "metric") {
  return system === "imperial"
    ? `${one.format(gramsToLb(g))} lb`
    : `${one.format(gramsToKg(g))} kg`;
}

/** Değişim, işaretiyle: "−1,2 kg", "+0,4 kg", "0 kg". */
export function formatWeightDelta(g: number, system: UnitSystem = "metric") {
  const abs = formatWeight(Math.abs(g), system);
  if (Math.round(Math.abs(g) / 100) === 0) return `0 ${system === "imperial" ? "lb" : "kg"}`;
  return `${g < 0 ? "−" : "+"}${abs}`;
}

export function formatHeight(mm: number, system: UnitSystem = "metric") {
  if (system === "imperial") {
    const inches = Math.round(mmToInches(mm));
    return `${Math.floor(inches / 12)}′${inches % 12}″`;
  }
  return `${one.format(mmToCm(mm))} cm`;
}

/** 1 km altı metre, üstü km: "800 m", "5,25 km". */
export function formatDistance(m: number, system: UnitSystem = "metric") {
  if (system === "imperial") return `${two.format(m / 1609.344)} mi`;
  return m < 1000 ? `${Math.round(m)} m` : `${two.format(metersToKm(m))} km`;
}

/** "45 dk", "1 sa", "1 sa 15 dk". */
export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

export const formatKcal = (kcal: number) =>
  `${new Intl.NumberFormat("tr-TR").format(Math.round(kcal))} kcal`;
