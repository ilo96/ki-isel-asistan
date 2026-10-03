import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  daysBetween,
  monthKeyOf,
  monthOf,
  previousMonthToDate,
  shiftMonth,
  type DateString,
} from "@/lib/dates";
import type { Db } from "@/server/db/client";
import { categories, transactions } from "@/server/db/schema";
import { num } from "./dashboard/context";
import { totalsBetween } from "./dashboard/totals";

export type CategoryShare = {
  id: string;
  name: string;
  icon: string;
  colorToken: string;
  totalMinor: number;
  count: number;
  /** Ayın toplam giderindeki (ya da gelirindeki) payı, 0–100 arası. */
  percent: number;
};

export type MonthOverview = {
  month: { start: DateString; end: DateString };
  /** Bugünün ayı mı; öyleyse kıyas geçen ayın aynı gününe kadar yapılır. */
  isCurrent: boolean;
  isFuture: boolean;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  /** Kıyaslanan önceki dönemin gideri (geçmiş aylar için önceki ayın tamamı). */
  previousExpenseMinor: number;
  expenseByCategory: CategoryShare[];
  incomeByCategory: CategoryShare[];
  /** Ayda gün başına ortalama gider; içinde bulunulan ayda bugüne kadarki günlere bölünür. */
  dailyAverageMinor: number;
};

/**
 * Finans ekranının bir ayı. Bütün sayılar burada hesaplanır; asistan da ileride
 * aynı rakamları buradan alıp yalnızca cümleye çevirir.
 */
export async function getMonthOverview(
  db: Db,
  userId: string,
  month: { start: DateString; end: DateString },
  today: DateString,
): Promise<MonthOverview> {
  const ctx = { db, userId, today };
  const isCurrent = today >= month.start && today <= month.end;
  const isFuture = month.start > today;
  const previous = isCurrent
    ? previousMonthToDate(today)
    : monthOf(`${shiftMonth(monthKeyOf(month.start), -1)}-01`);

  const [totals, prev, byCategory] = await Promise.all([
    totalsBetween(ctx, month.start, month.end),
    totalsBetween(ctx, previous.start, previous.end),
    db
      .select({
        id: categories.id,
        type: transactions.type,
        name: categories.name,
        icon: categories.icon,
        colorToken: categories.colorToken,
        total: sql<string>`sum(${transactions.amountMinor})`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.occurredOn, month.start),
          lte(transactions.occurredOn, month.end),
        ),
      )
      .groupBy(categories.id, transactions.type)
      .orderBy(desc(sql`sum(${transactions.amountMinor})`)),
  ]);

  const shares = (type: "income" | "expense", total: number): CategoryShare[] =>
    byCategory
      .filter((r) => r.type === type)
      .map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        colorToken: r.colorToken,
        count: r.count,
        totalMinor: num(r.total),
        percent: total > 0 ? Math.round((num(r.total) / total) * 1000) / 10 : 0,
      }));

  const elapsedDays = isCurrent
    ? daysBetween(month.start, today) + 1
    : daysBetween(month.start, month.end) + 1;

  return {
    month,
    isCurrent,
    isFuture,
    incomeMinor: totals.income,
    expenseMinor: totals.expense,
    netMinor: totals.income - totals.expense,
    previousExpenseMinor: prev.expense,
    expenseByCategory: shares("expense", totals.expense),
    incomeByCategory: shares("income", totals.income),
    dailyAverageMinor: isFuture ? 0 : Math.round(totals.expense / elapsedDays),
  };
}
