import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { daysBetween, monthOf, shiftMonth, type DateString, type MonthKey } from "@/lib/dates";
import { budgetInputSchema, type BudgetInput } from "@/lib/validation/finance";
import type { Db } from "@/server/db/client";
import { budgets, categories, transactions } from "@/server/db/schema";
import { assertCategory } from "./categories";
import { num } from "./dashboard/context";

/*
 * Bütçeler bir başlangıç ayından itibaren her ay geçerlidir: her kategori için o aya
 * kadar girilmiş en son satır kullanılır. Tutarı 0 olan satır "bu aydan itibaren bütçe yok"
 * demektir; böylece geçmiş aylar bozulmadan bütçe kaldırılabilir.
 */

export type BudgetStatus = "ok" | "warning" | "over";

/** Plan: varsayılan eşikler %80 ve %100. */
export const DEFAULT_THRESHOLDS = [80, 100] as const;

export type BudgetLine = {
  categoryId: string | null;
  name: string | null;
  icon: string | null;
  colorToken: string | null;
  limitMinor: number;
  spentMinor: number;
  /** spent / limit; 1'in üstü aşım. */
  ratio: number;
  status: BudgetStatus;
  /** İçinde bulunulan ayda bu hızla ay sonunda ulaşılacak tutar; ilk 7 gün ve diğer aylarda null. */
  projectedMinor: number | null;
  /** Bu satırın girildiği ay; önceki aydan devralındıysa o ay. */
  since: MonthKey;
};

export type UnbudgetedCategory = {
  categoryId: string;
  name: string;
  icon: string;
  colorToken: string;
  spentMinor: number;
};

export type MonthBudgets = {
  month: { start: DateString; end: DateString };
  isCurrent: boolean;
  daysLeft: number;
  overall: BudgetLine | null;
  lines: BudgetLine[];
  /** Kategori bütçelerinin toplamı ve o kategorilerdeki harcama. */
  categoryTotal: { limitMinor: number; spentMinor: number };
  unbudgeted: UnbudgetedCategory[];
  /** Kategori → son 3 ayın ortalama gideri; bütçe formunda öneri olarak gösterilir. */
  suggestions: Record<string, number>;
  /** Ayın toplam gideri (genel bütçe önerisi için son 3 ay ortalaması da). */
  expenseMinor: number;
  overallSuggestionMinor: number;
};

export function statusOf(
  ratio: number,
  thresholds: readonly number[] = DEFAULT_THRESHOLDS,
): BudgetStatus {
  const sorted = [...thresholds].sort((a, b) => a - b);
  const warn = (sorted[0] ?? 80) / 100;
  const over = (sorted.at(-1) ?? 100) / 100;
  if (ratio >= over) return "over";
  if (ratio >= warn) return "warning";
  return "ok";
}

/** Ayda geçerli olan bütçe satırları (tutarı 0 olanlar hariç). */
export async function effectiveBudgets(db: Db, userId: string, monthStart: DateString) {
  const rows = await db
    .selectDistinctOn([budgets.categoryId], {
      categoryId: budgets.categoryId,
      amountMinor: budgets.amountMinor,
      startsOn: budgets.startsOn,
      alertThresholds: budgets.alertThresholds,
    })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), lte(budgets.startsOn, monthStart)))
    .orderBy(budgets.categoryId, desc(budgets.startsOn));
  return rows.filter((r) => r.amountMinor > 0);
}

async function spendingByCategory(db: Db, userId: string, start: DateString, end: DateString) {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
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
    .groupBy(transactions.categoryId);
  return new Map(rows.map((r) => [r.categoryId, num(r.total)]));
}

const SUGGESTION_MONTHS = 3;
/** Ayın ilk günlerinde (kira gibi tek seferlik büyük ödemeler yüzünden) tahmin yanıltıcıdır. */
export const PROJECTION_MIN_DAYS = 7;

/** Öneriler 100 TL'ye yuvarlanır; "₺4.237,18" yerine "₺4.300" daha kullanışlı bir hedef. */
const roundUp = (minor: number) => Math.ceil(minor / 10_000) * 10_000;

export async function getMonthBudgets(
  db: Db,
  userId: string,
  month: { start: DateString; end: DateString },
  today: DateString,
): Promise<MonthBudgets> {
  const isCurrent = today >= month.start && today <= month.end;
  const monthKey = month.start.slice(0, 7);
  const pastStart = `${shiftMonth(monthKey, -SUGGESTION_MONTHS)}-01`;
  const pastEnd = monthOf(`${shiftMonth(monthKey, -1)}-01`).end;

  const [effective, spent, past, cats] = await Promise.all([
    effectiveBudgets(db, userId, month.start),
    spendingByCategory(db, userId, month.start, month.end),
    spendingByCategory(db, userId, pastStart, pastEnd),
    db
      .select({
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        colorToken: categories.colorToken,
        archivedAt: categories.archivedAt,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.type, "expense")))
      .orderBy(categories.sortOrder),
  ]);

  const totalDays = daysBetween(month.start, month.end) + 1;
  const elapsed = isCurrent ? daysBetween(month.start, today) + 1 : totalDays;
  const expenseMinor = [...spent.values()].reduce((a, b) => a + b, 0);

  const line = (
    row: (typeof effective)[number],
    spentMinor: number,
    cat?: (typeof cats)[number],
  ): BudgetLine => {
    const ratio = row.amountMinor > 0 ? spentMinor / row.amountMinor : 0;
    return {
      categoryId: row.categoryId,
      name: cat?.name ?? null,
      icon: cat?.icon ?? null,
      colorToken: cat?.colorToken ?? null,
      limitMinor: row.amountMinor,
      spentMinor,
      ratio,
      status: statusOf(ratio, row.alertThresholds),
      projectedMinor:
        isCurrent && elapsed >= PROJECTION_MIN_DAYS
          ? Math.round((spentMinor / elapsed) * totalDays)
          : null,
      since: row.startsOn.slice(0, 7),
    };
  };

  const overallRow = effective.find((r) => r.categoryId === null);
  const lines = effective
    .filter((r) => r.categoryId !== null)
    .map((r) => {
      const cat = cats.find((c) => c.id === r.categoryId);
      return line(r, spent.get(r.categoryId!) ?? 0, cat);
    })
    .sort((a, b) => b.ratio - a.ratio);

  const budgeted = new Set(lines.map((l) => l.categoryId));
  const unbudgeted = cats
    .filter((c) => !budgeted.has(c.id) && (!c.archivedAt || spent.has(c.id)))
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      colorToken: c.colorToken,
      spentMinor: spent.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.spentMinor - a.spentMinor);

  const suggestions: Record<string, number> = {};
  for (const c of cats) {
    const total = past.get(c.id) ?? 0;
    if (total > 0) suggestions[c.id] = roundUp(total / SUGGESTION_MONTHS);
  }
  const pastTotal = [...past.values()].reduce((a, b) => a + b, 0);

  return {
    month,
    isCurrent,
    daysLeft: isCurrent ? daysBetween(today, month.end) : 0,
    overall: overallRow ? line(overallRow, expenseMinor) : null,
    lines,
    categoryTotal: {
      limitMinor: lines.reduce((s, l) => s + l.limitMinor, 0),
      spentMinor: lines.reduce((s, l) => s + l.spentMinor, 0),
    },
    unbudgeted,
    suggestions,
    expenseMinor,
    overallSuggestionMinor: pastTotal > 0 ? roundUp(pastTotal / SUGGESTION_MONTHS) : 0,
  };
}

/** Bütçeyi seçilen aydan itibaren koyar ya da değiştirir. */
export async function setBudget(db: Db, userId: string, input: BudgetInput) {
  const data = budgetInputSchema.parse(input);
  if (data.categoryId) await assertCategory(db, userId, data.categoryId, "expense");
  await upsert(db, userId, data.categoryId, data.amountMinor, `${data.month}-01`);
}

/** Bütçeyi seçilen aydan itibaren kaldırır; önceki aylar olduğu gibi kalır. */
export async function removeBudget(
  db: Db,
  userId: string,
  { categoryId, month }: { categoryId: string | null; month: MonthKey },
) {
  await upsert(db, userId, categoryId, 0, `${month}-01`);
}

async function upsert(
  db: Db,
  userId: string,
  categoryId: string | null,
  amountMinor: number,
  startsOn: DateString,
) {
  await db
    .insert(budgets)
    .values({ userId, categoryId, amountMinor, startsOn })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.startsOn],
      set: { amountMinor, updatedAt: new Date() },
    });
}
