import { dayIn, daysBetween, monthOf, previousMonthToDate } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import type { Context } from "./context";
import { hasRemindersOrBudgets, recentTransactions, upcomingItems } from "./lists";
import { activeSavingGoal, balance, budgetFor, topExpenseCategory, totalsBetween } from "./totals";
import type { DashboardData } from "./types";

/*
 * Ana sayfanın bütün rakamları burada, kodla hesaplanır (plan: InsightService).
 * Ekran ve ileride asistan aynı sonucu okur; model hiçbir rakamı kendisi üretmez.
 */

export type * from "./types";
export { OVERDUE_DAYS, UPCOMING_DAYS } from "./lists";

export async function getDashboard(
  db: Db,
  user: { id: string; timezone: string },
  now = new Date(),
): Promise<DashboardData> {
  const today = dayIn(now, user.timezone);
  const month = monthOf(today);
  const previous = previousMonthToDate(today);
  const ctx: Context = { db, userId: user.id, today };

  const [
    monthTotals,
    previousExpense,
    balanceMinor,
    budget,
    goal,
    topCategory,
    upcoming,
    recent,
    other,
  ] = await Promise.all([
    totalsBetween(ctx, month.start, month.end),
    totalsBetween(ctx, previous.start, previous.end),
    balance(ctx),
    budgetFor(ctx, month),
    activeSavingGoal(ctx),
    topExpenseCategory(ctx, month),
    upcomingItems(ctx, now, user.timezone),
    recentTransactions(ctx),
    hasRemindersOrBudgets(ctx),
  ]);

  return {
    today,
    month,
    daysLeftInMonth: daysBetween(today, month.end),
    isEmpty: recent.length === 0 && !other,
    balanceMinor,
    incomeMinor: monthTotals.income,
    expenseMinor: monthTotals.expense,
    previousExpenseToDateMinor: previousExpense.expense,
    budget,
    goal,
    topCategory,
    upcoming,
    recent,
  };
}
export { buildInsights, type Insight } from "./insights";
