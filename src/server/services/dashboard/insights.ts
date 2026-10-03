import type { DashboardData } from "./types";

/*
 * Asistan özetinin olguları. Hangi cümlenin söyleneceğine kod karar verir, metin
 * çeviri dosyasındadır. Faz 8'de aynı olgular hızlı modele verilip doğal dile çevrilecek.
 */

export type Insight =
  | { key: "billOverdue"; title: string; amountMinor: number | null }
  | { key: "billSoon"; title: string; days: number; amountMinor: number | null }
  | { key: "budgetOver"; overMinor: number }
  | { key: "budgetHigh"; percent: number; daysLeft: number }
  | { key: "expenseDown" | "expenseUp"; percent: number }
  | { key: "goalReached"; targetMinor: number }
  | { key: "goalLeft"; leftMinor: number }
  | { key: "topCategory"; name: string; amountMinor: number }
  | { key: "monthStart" };

/** Ödemenin "yaklaşıyor" sayıldığı gün sayısı (plan: 5 gün içindeki ödemeler). */
export const BILL_SOON_DAYS = 5;
/** Bütçe uyarısı eşiği (plan: varsayılan 80, 100). */
export const BUDGET_WARN = 0.8;
/** Bundan küçük değişimler "aynı" sayılır; özet gereksiz rakamla dolmasın. */
const TREND_MIN_PERCENT = 5;
const MAX_INSIGHTS = 2;

/** Öncelik sırası planla aynı: vadesi gelen ödeme > bütçe aşımı > eşik > trend. */
export function buildInsights(data: DashboardData): Insight[] {
  if (data.isEmpty) return [];
  const out: Insight[] = [];

  const bill = data.upcoming.find((u) => u.kind === "bill" && u.daysUntil <= BILL_SOON_DAYS);
  if (bill?.overdue) {
    out.push({ key: "billOverdue", title: bill.title, amountMinor: bill.amountMinor });
  } else if (bill) {
    out.push({
      key: "billSoon",
      title: bill.title,
      days: bill.daysUntil,
      amountMinor: bill.amountMinor,
    });
  }

  if (data.budget && data.budget.limitMinor > 0) {
    const { limitMinor, spentMinor } = data.budget;
    const ratio = spentMinor / limitMinor;
    if (ratio >= 1) out.push({ key: "budgetOver", overMinor: spentMinor - limitMinor });
    else if (ratio >= BUDGET_WARN) {
      out.push({
        key: "budgetHigh",
        percent: Math.floor(ratio * 100),
        daysLeft: data.daysLeftInMonth,
      });
    }
  }

  const previous = data.previousExpenseToDateMinor;
  if (previous > 0 && data.expenseMinor > 0) {
    const change = Math.round(((data.expenseMinor - previous) / previous) * 100);
    if (Math.abs(change) >= TREND_MIN_PERCENT) {
      out.push({ key: change < 0 ? "expenseDown" : "expenseUp", percent: Math.abs(change) });
    }
  }

  if (data.goal) {
    const left = data.goal.targetMinor - data.goal.savedMinor;
    out.push(
      left <= 0
        ? { key: "goalReached", targetMinor: data.goal.targetMinor }
        : { key: "goalLeft", leftMinor: left },
    );
  }

  if (data.topCategory) {
    out.push({
      key: "topCategory",
      name: data.topCategory.name,
      amountMinor: data.topCategory.amountMinor,
    });
  }

  if (out.length === 0) out.push({ key: "monthStart" });
  return out.slice(0, MAX_INSIGHTS);
}
