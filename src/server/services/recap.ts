import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { monthOf, shiftMonth, type DateString } from "@/lib/dates";
import { countNoSpendDays, longestRun, pickPersona, type MonthlyRecap } from "@/lib/recap";
import type { Db } from "@/server/db/client";
import { categories, transactions } from "@/server/db/schema";
import { alive, num } from "./dashboard/context";
import { totalsBetween } from "./dashboard/totals";

/*
 * Aylık özet: bir ayın gelir, gider, en çok harcanan kategoriler, en büyük harcama,
 * harcamasız günler ve seri. Paylaşılabilir kartın ve özet sayfasının tek veri kaynağı.
 */

const MONTH_LABEL = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export async function getMonthlyRecap(
  db: Db,
  userId: string,
  monthKey: string,
  today: DateString,
): Promise<MonthlyRecap> {
  const month = monthOf(`${monthKey}-01`);
  const partial = today >= month.start && today <= month.end;
  const end = partial ? today : month.end;
  const prev = monthOf(`${shiftMonth(monthKey, -1)}-01`);
  const ctx = { db, userId, today };
  const inMonth = and(
    alive(userId),
    gte(transactions.occurredOn, month.start),
    lte(transactions.occurredOn, month.end),
  );
  const total = sql<string>`sum(${transactions.amountMinor})`;

  const [totals, before, [txCount], cats, [biggest], weekdays, days] = await Promise.all([
    totalsBetween(ctx, month.start, month.end),
    totalsBetween(ctx, prev.start, prev.end),
    db.select({ n: count() }).from(transactions).where(inMonth),
    db
      .select({
        name: categories.name,
        systemKey: categories.systemKey,
        icon: categories.icon,
        colorToken: categories.colorToken,
        total,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(inMonth, eq(transactions.type, "expense")))
      .groupBy(
        categories.id,
        categories.name,
        categories.systemKey,
        categories.icon,
        categories.colorToken,
      )
      .orderBy(desc(total))
      .limit(3),
    db
      .select({
        description: transactions.description,
        amountMinor: transactions.amountMinor,
        occurredOn: transactions.occurredOn,
      })
      .from(transactions)
      .where(and(inMonth, eq(transactions.type, "expense")))
      .orderBy(desc(transactions.amountMinor))
      .limit(1),
    db
      .select({ dow: sql<string>`extract(dow from ${transactions.occurredOn})`, total })
      .from(transactions)
      .where(and(inMonth, eq(transactions.type, "expense")))
      .groupBy(sql`1`)
      .orderBy(desc(total))
      .limit(1),
    db
      .selectDistinct({ day: transactions.occurredOn, type: transactions.type })
      .from(transactions)
      .where(inMonth),
  ]);

  const expenseDays = new Set(days.filter((d) => d.type === "expense").map((d) => d.day));
  const anyDays = new Set(days.map((d) => d.day));
  const savingsRate = totals.income > 0 ? (totals.income - totals.expense) / totals.income : null;
  const topCategories = cats.map((c) => ({
    name: c.name,
    systemKey: c.systemKey,
    icon: c.icon,
    colorToken: c.colorToken,
    amountMinor: num(c.total),
    share: totals.expense > 0 ? num(c.total) / totals.expense : 0,
  }));

  return {
    monthKey,
    label: MONTH_LABEL.format(new Date(`${month.start}T12:00:00Z`)),
    partial,
    incomeMinor: totals.income,
    expenseMinor: totals.expense,
    netMinor: totals.income - totals.expense,
    savingsRate,
    expenseChange:
      before.expense > 0
        ? Math.round(((totals.expense - before.expense) / before.expense) * 100)
        : null,
    transactionCount: txCount?.n ?? 0,
    topCategories,
    biggest: biggest ?? null,
    busiestWeekday: weekdays[0] ? Number(weekdays[0].dow) : null,
    noSpendDays: today < month.start ? 0 : countNoSpendDays(expenseDays, month.start, end),
    bestStreak: longestRun(anyDays, month.start, end),
    persona: pickPersona(savingsRate, topCategories[0]?.systemKey ?? null),
    isEmpty: (txCount?.n ?? 0) === 0,
  };
}
