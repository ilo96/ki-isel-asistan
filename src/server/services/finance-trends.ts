import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { daysBetween, monthOf, shiftMonth, type DateString, type MonthKey } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import { transactions } from "@/server/db/schema";
import { num } from "./dashboard/context";

/*
 * Finans ekranının grafik verileri. Rakamlar burada hesaplanır; grafik bileşenleri
 * yalnızca çizer. Asistan da aynı serileri okuyabilir.
 */

export type MonthPoint = {
  month: MonthKey;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
};

/** Son `count` ayın gelir ve gideri, en eskiden yeniye. İşlemi olmayan aylar sıfırla gelir. */
export async function getMonthlySeries(
  db: Db,
  userId: string,
  endMonth: MonthKey,
  count: number,
): Promise<MonthPoint[]> {
  const startMonth = shiftMonth(endMonth, -(count - 1));
  const monthExpr = sql<string>`to_char(${transactions.occurredOn}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month: monthExpr,
      type: transactions.type,
      total: sql<string>`sum(${transactions.amountMinor})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.occurredOn, `${startMonth}-01`),
        lte(transactions.occurredOn, monthOf(`${endMonth}-01`).end),
      ),
    )
    .groupBy(monthExpr, transactions.type);

  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(startMonth, i);
    const of = (type: string) => num(rows.find((r) => r.month === month && r.type === type)?.total);
    const incomeMinor = of("income");
    const expenseMinor = of("expense");
    return { month, incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
  });
}

export type CumulativePoint = {
  /** Ayın günü, 1'den başlar. */
  day: number;
  /** Bu ay o güne kadarki toplam gider; bugünden sonrası için null (çizgi orada biter). */
  current: number | null;
  /** Önceki ay aynı güne kadarki toplam gider; önceki ayda o gün yoksa null. */
  previous: number | null;
};

async function dailyExpense(db: Db, userId: string, start: DateString, end: DateString) {
  const rows = await db
    .select({
      day: transactions.occurredOn,
      total: sql<string>`sum(${transactions.amountMinor})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    )
    .groupBy(transactions.occurredOn);
  const byDay = new Map<number, number>();
  for (const r of rows) byDay.set(daysBetween(start, r.day) + 1, num(r.total));
  return byDay;
}

/**
 * Ay içinde günlere göre birikimli gider, önceki ayın aynı günleriyle yan yana.
 * "Ayın bu noktasında geçen aydan önde miyim?" sorusunun grafiği.
 */
export async function getCumulativeExpense(
  db: Db,
  userId: string,
  month: { start: DateString; end: DateString },
  today: DateString,
): Promise<CumulativePoint[]> {
  const previous = monthOf(`${shiftMonth(month.start.slice(0, 7), -1)}-01`);
  const [current, prev] = await Promise.all([
    dailyExpense(db, userId, month.start, month.end),
    dailyExpense(db, userId, previous.start, previous.end),
  ]);
  const days = daysBetween(month.start, month.end) + 1;
  const prevDays = daysBetween(previous.start, previous.end) + 1;
  const lastDay =
    today < month.start ? 0 : today > month.end ? days : daysBetween(month.start, today) + 1;

  let runCurrent = 0;
  let runPrevious = 0;
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    runCurrent += current.get(day) ?? 0;
    runPrevious += prev.get(day) ?? 0;
    return {
      day,
      current: day <= lastDay ? runCurrent : null,
      previous: day <= prevDays ? runPrevious : null,
    };
  });
}
