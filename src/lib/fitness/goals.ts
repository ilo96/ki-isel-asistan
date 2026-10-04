import { addDays, daysBetween, type DateString } from "@/lib/dates";
import { normalWeightRange } from "./bmi";

/*
 * Kilo hedefi hesapları (saf fonksiyonlar). Hız uyarıları genel kabul gören sınırlara göre:
 * haftada 1 kg'dan hızlı kayıp ya da 0,5 kg'dan hızlı alım önerilmez. Bunlar tıbbi tavsiye
 * değildir; arayüz gerektiğinde bir sağlık uzmanına danışmayı hatırlatır.
 */

export const SAFE_LOSS_G_PER_WEEK = 1000;
export const SAFE_GAIN_G_PER_WEEK = 500;

export type WeightPoint = { date: DateString; weightG: number };

export type GoalProgress = {
  direction: "lose" | "gain" | "keep";
  /** 0–1, hedefe ne kadar yaklaşıldığı. */
  ratio: number;
  /** Hedefe kalan (pozitif sayı, gram); hedefe ulaşıldıysa 0. */
  remainingG: number;
  reached: boolean;
};

export function goalProgress(startG: number, currentG: number, targetG: number): GoalProgress {
  const direction = targetG < startG ? "lose" : targetG > startG ? "gain" : "keep";
  const total = Math.abs(startG - targetG);
  const done =
    direction === "lose" ? startG - currentG : direction === "gain" ? currentG - startG : 0;
  const remaining =
    direction === "lose"
      ? currentG - targetG
      : direction === "gain"
        ? targetG - currentG
        : Math.abs(currentG - targetG);
  const reached = direction === "keep" ? remaining <= 500 : remaining <= 0;
  return {
    direction,
    ratio: total === 0 ? (reached ? 1 : 0) : Math.max(0, Math.min(1, done / total)),
    remainingG: Math.max(0, remaining),
    reached,
  };
}

/**
 * Son ölçümlerden günlük eğilim (gram/gün), en küçük kareler. En az iki ölçüm ve 7 günlük
 * aralık yoksa null: birkaç günlük dalgalanmadan tahmin yapılmaz.
 */
export function weightTrend(
  points: readonly WeightPoint[],
  today: DateString,
  windowDays = 28,
): number | null {
  const from = addDays(today, -windowDays);
  const pts = points.filter((p) => p.date >= from && p.date <= today);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => daysBetween(from, p.date));
  if (Math.max(...xs) - Math.min(...xs) < 7) return null;
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = pts.reduce((a, p) => a + p.weightG, 0) / n;
  let num = 0;
  let den = 0;
  pts.forEach((p, i) => {
    num += (xs[i]! - mx) * (p.weightG - my);
    den += (xs[i]! - mx) ** 2;
  });
  return den === 0 ? null : num / den;
}

/** Bu eğilimle hedefe kaç gün kaldığı; eğilim hedefe doğru değilse null. */
export function etaDays(progress: GoalProgress, trendGPerDay: number | null) {
  if (progress.reached) return 0;
  if (trendGPerDay === null || progress.direction === "keep") return null;
  const toward = progress.direction === "lose" ? -trendGPerDay : trendGPerDay;
  if (toward < 5) return null; // günde 5 g'dan yavaşsa anlamlı bir tahmin yok
  return Math.ceil(progress.remainingG / toward);
}

export type GoalSafety = {
  /** Hedef tarihe yetişmek için gereken haftalık değişim (gram, pozitif). */
  requiredGPerWeek: number | null;
  tooFast: boolean;
  /** Hedef kilo bu boyda VKİ 18,5'in altına düşüyor. */
  belowHealthyRange: boolean;
  /** Güvenli hızla tahmini en erken tarih. */
  saferDate: DateString | null;
};

export function goalSafety(
  currentG: number,
  targetG: number,
  targetDate: DateString | null,
  today: DateString,
  heightMm: number | null,
): GoalSafety {
  const diff = Math.abs(currentG - targetG);
  const losing = targetG < currentG;
  const limit = losing ? SAFE_LOSS_G_PER_WEEK : SAFE_GAIN_G_PER_WEEK;
  const weeks = targetDate ? Math.max(daysBetween(today, targetDate), 1) / 7 : null;
  const required = weeks ? diff / weeks : null;
  const tooFast = required !== null && required > limit;
  const saferDate = tooFast ? addDays(today, Math.ceil((diff / limit) * 7)) : null;
  const belowHealthyRange = heightMm ? losing && targetG < normalWeightRange(heightMm).minG : false;
  return {
    requiredGPerWeek: required === null ? null : Math.round(required),
    tooFast,
    belowHealthyRange,
    saferDate,
  };
}
