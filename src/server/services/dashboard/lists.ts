import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { dayIn, daysBetween } from "@/lib/dates";
import { budgets, reminders } from "@/server/db/schema";
import { listTransactions } from "../transactions";
import type { Context } from "./context";
import type { RecentTransaction, UpcomingItem } from "./types";

export const UPCOMING_DAYS = 14;
/** Ödenmemiş geçmiş faturalar bu kadar gün "Gecikti" olarak listede kalır. */
export const OVERDUE_DAYS = 7;
const LIST_LIMIT = 5;

export async function upcomingItems({ db, userId, today }: Context, now: Date, timeZone: string) {
  const from = new Date(now.getTime() - OVERDUE_DAYS * 86_400_000);
  const until = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000);
  const rows = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        isNull(reminders.completedAt),
        isNull(reminders.deletedAt),
        gte(reminders.dueAt, from),
        lt(reminders.dueAt, until),
      ),
    )
    .orderBy(asc(reminders.dueAt))
    .limit(LIST_LIMIT * 2);

  return (
    rows
      .map((r): UpcomingItem => {
        const daysUntil = daysBetween(today, dayIn(r.dueAt, timeZone));
        // Gün içi hatırlatıcı saati geçince, tüm gün olanlar ertesi gün gecikmiş sayılır.
        const overdue = r.allDay ? daysUntil < 0 : r.dueAt < now;
        return {
          id: r.id,
          kind: r.kind,
          title: r.title,
          dueAt: r.dueAt,
          allDay: r.allDay,
          amountMinor: r.amountMinor,
          daysUntil,
          overdue,
        };
      })
      // Geçmiş tarihli sıradan hatırlatıcılar değil, yalnızca ödenmemiş faturalar listede kalır.
      .filter((item) => !item.overdue || item.kind === "bill")
      .slice(0, LIST_LIMIT)
  );
}

/** Son beş işlem; ileri tarihli (planlanmış) işlemler bugüne gelene kadar burada görünmez. */
export async function recentTransactions({
  db,
  userId,
  today,
}: Context): Promise<RecentTransaction[]> {
  const { items } = await listTransactions(db, userId, { end: today, limit: LIST_LIMIT });
  return items.map((t) => ({ ...t, daysAgo: daysBetween(t.occurredOn, today) }));
}

export async function hasRemindersOrBudgets({ db, userId }: Context) {
  const [r] = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(and(eq(reminders.userId, userId), isNull(reminders.deletedAt)))
    .limit(1);
  if (r) return true;
  const [b] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(eq(budgets.userId, userId))
    .limit(1);
  return Boolean(b);
}
