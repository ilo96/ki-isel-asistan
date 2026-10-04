import { addDays, daysBetween, type DateString } from "@/lib/dates";

/*
 * Aylık özet ("ayın karnesi") hesapları: saf fonksiyonlar. Sayılar servis tarafından
 * veritabanından toplanır; persona ve günlük istatistikler burada türetilir.
 */

export type RecapCategory = {
  name: string;
  systemKey: string | null;
  icon: string;
  colorToken: string;
  amountMinor: number;
  share: number;
};

export type MonthlyRecap = {
  monthKey: string;
  /** "Eylül 2026" */
  label: string;
  /** Ay henüz bitmediyse true: özet "şimdiye kadar" diye gösterilir. */
  partial: boolean;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  /** Net / gelir; gelir yoksa null. */
  savingsRate: number | null;
  /** Önceki aya göre gider değişimi (%), önceki ayda gider yoksa null. */
  expenseChange: number | null;
  transactionCount: number;
  topCategories: RecapCategory[];
  biggest: { description: string; amountMinor: number; occurredOn: DateString } | null;
  /** En çok harcanan haftanın günü (0 = pazar). */
  busiestWeekday: number | null;
  noSpendDays: number;
  bestStreak: number;
  persona: Persona;
  isEmpty: boolean;
};

export type Persona = { key: string; emoji: string };

const PERSONAS: Record<string, Persona> = {
  groceries: { key: "chef", emoji: "🧺" },
  food: { key: "gourmet", emoji: "🍽️" },
  transport: { key: "traveler", emoji: "🚕" },
  entertainment: { key: "fun", emoji: "🎬" },
  shopping: { key: "shopper", emoji: "🛍️" },
  bills: { key: "steady", emoji: "📋" },
  rent: { key: "home", emoji: "🏠" },
  health: { key: "healthy", emoji: "🌿" },
};

/** Birikim oranı %20 ve üstüyse "Birikim ustası"; değilse en çok harcanan kategoriye göre. */
export function pickPersona(savingsRate: number | null, topKey: string | null): Persona {
  if (savingsRate !== null && savingsRate >= 0.2) return { key: "saver", emoji: "🐷" };
  return (topKey && PERSONAS[topKey]) || { key: "balanced", emoji: "⚖️" };
}

/** Aralıktaki gider olmayan günler (to dahil). */
export function countNoSpendDays(
  expenseDays: ReadonlySet<DateString>,
  from: DateString,
  to: DateString,
) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (!expenseDays.has(d)) n++;
  return n;
}

/** Aralık içindeki en uzun kayıt serisi. */
export function longestRun(days: ReadonlySet<DateString>, from: DateString, to: DateString) {
  let best = 0;
  let run = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    run = days.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export const daysInRange = (from: DateString, to: DateString) => daysBetween(from, to) + 1;
