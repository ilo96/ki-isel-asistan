import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { DateString } from "@/lib/dates";
import {
  budgets,
  categories,
  financialGoals,
  paymentMethods,
  transactions,
} from "@/server/db/schema";
import { alive, num, type Context, type Range } from "./context";

export async function totalsBetween({ db, userId }: Context, start: DateString, end: DateString) {
  const rows = await db
    .select({ type: transactions.type, total: sql<string>`sum(${transactions.amountMinor})` })
    .from(transactions)
    .where(
      and(alive(userId), gte(transactions.occurredOn, start), lte(transactions.occurredOn, end)),
    )
    .groupBy(transactions.type);
  const of = (type: string) => num(rows.find((r) => r.type === type)?.total);
  return { income: of("income"), expense: of("expense") };
}

export async function balance({ db, userId }: Context) {
  const [moves] = await db
    .select({
      total: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountMinor} else -${transactions.amountMinor} end), 0)`,
    })
    .from(transactions)
    .where(alive(userId));
  const [opening] = await db
    .select({ total: sql<string>`coalesce(sum(${paymentMethods.openingBalanceMinor}), 0)` })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.archivedAt)));
  return num(moves?.total) + num(opening?.total);
}

/**
 * Aylık bütçeler bir başlangıç ayından itibaren geçerlidir; her kategori için o aya
 * kadar girilmiş en son tutar kullanılır. Genel bütçe varsa kategori bütçelerinin önüne geçer.
 */
export async function budgetFor({ db, userId }: Context, month: Range) {
  const rows = await db
    .selectDistinctOn([budgets.categoryId], {
      categoryId: budgets.categoryId,
      amountMinor: budgets.amountMinor,
    })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), lte(budgets.startsOn, month.start)))
    .orderBy(budgets.categoryId, desc(budgets.startsOn));
  if (rows.length === 0) return null;

  const overall = rows.find((r) => r.categoryId === null);
  const range = and(
    alive(userId),
    eq(transactions.type, "expense"),
    gte(transactions.occurredOn, month.start),
    lte(transactions.occurredOn, month.end),
  );
  if (overall) {
    const [spent] = await db
      .select({ total: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)` })
      .from(transactions)
      .where(range);
    return {
      limitMinor: overall.amountMinor,
      spentMinor: num(spent?.total),
      scope: "overall" as const,
    };
  }
  const ids = rows.map((r) => r.categoryId).filter((id): id is string => id !== null);
  const [spent] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)` })
    .from(transactions)
    .where(and(range, inArray(transactions.categoryId, ids)));
  return {
    limitMinor: rows.reduce((sum, r) => sum + r.amountMinor, 0),
    spentMinor: num(spent?.total),
    scope: "categories" as const,
  };
}

/** Bugünü kapsayan aktif birikim hedefi; birikim = dönemdeki gelir − gider. */
export async function activeSavingGoal(ctx: Context) {
  const { db, userId, today } = ctx;
  const [goal] = await db
    .select()
    .from(financialGoals)
    .where(
      and(
        eq(financialGoals.userId, userId),
        eq(financialGoals.kind, "saving"),
        eq(financialGoals.status, "active"),
        lte(financialGoals.periodStart, today),
        gte(financialGoals.periodEnd, today),
      ),
    )
    .orderBy(desc(financialGoals.createdAt))
    .limit(1);
  if (!goal) return null;
  const totals = await totalsBetween(ctx, goal.periodStart, goal.periodEnd);
  return {
    title: goal.title,
    targetMinor: goal.targetMinor,
    savedMinor: Math.max(0, totals.income - totals.expense),
  };
}

export async function topExpenseCategory({ db, userId }: Context, month: Range) {
  const total = sql<string>`sum(${transactions.amountMinor})`;
  const [row] = await db
    .select({ name: categories.name, total })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        alive(userId),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, month.start),
        lte(transactions.occurredOn, month.end),
      ),
    )
    .groupBy(categories.id, categories.name)
    .orderBy(desc(total))
    .limit(1);
  return row ? { name: row.name, amountMinor: num(row.total) } : null;
}
