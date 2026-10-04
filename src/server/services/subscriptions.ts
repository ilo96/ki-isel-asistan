import { and, asc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { addDays, daysBetween, type DateString } from "@/lib/dates";
import type { CurrencyCode } from "@/lib/money";
import {
  detectSubscriptions,
  monthlyCost,
  nextChargeOn,
  type SubscriptionCycle,
  type SubscriptionSuggestion,
} from "@/lib/subscriptions";
import { subscriptionInputSchema, type SubscriptionInput } from "@/lib/validation/finance";
import type { Db } from "@/server/db/client";
import { categories, subscriptions, transactions } from "@/server/db/schema";
import { assertCategory, FinanceError } from "./categories";
import type { Candidate, NotificationUser } from "./notifications";

/*
 * Abonelik takibi. Kayıtlar yalnızca takip içindir: ödeme günü yaklaşınca haber verilir,
 * aylık/yıllık toplam gösterilir. Gider kaydı kullanıcı ödediğinde her zamanki gibi eklenir.
 */

export type SubscriptionView = {
  id: string;
  name: string;
  amountMinor: number;
  cycle: SubscriptionCycle;
  /** Kayıttaki ilk ödeme günü (formda düzenlenen değer). */
  anchorOn: DateString;
  nextChargeOn: DateString;
  daysUntil: number;
  monthlyMinor: number;
  categoryId: string | null;
  categoryName: string | null;
  remindDaysBefore: number;
  note: string | null;
  cancelled: boolean;
};

export type SubscriptionOverview = {
  active: SubscriptionView[];
  cancelled: SubscriptionView[];
  monthlyMinor: number;
  yearlyMinor: number;
  suggestions: SubscriptionSuggestion[];
};

const own = (userId: string, id: string) =>
  and(eq(subscriptions.id, id), eq(subscriptions.userId, userId));

const DETECT_DAYS = 120;

export async function listSubscriptions(
  db: Db,
  userId: string,
  today: DateString,
): Promise<SubscriptionView[]> {
  const rows = await db
    .select({ s: subscriptions, categoryName: categories.name })
    .from(subscriptions)
    .leftJoin(categories, eq(categories.id, subscriptions.categoryId))
    .where(eq(subscriptions.userId, userId))
    .orderBy(asc(subscriptions.createdAt));
  return rows
    .map(({ s, categoryName }) => {
      const next = nextChargeOn(s.nextChargeOn, s.cycle, today);
      return {
        id: s.id,
        name: s.name,
        amountMinor: s.amountMinor,
        cycle: s.cycle,
        anchorOn: s.nextChargeOn,
        nextChargeOn: next,
        daysUntil: daysBetween(today, next),
        monthlyMinor: monthlyCost(s.amountMinor, s.cycle),
        categoryId: s.categoryId,
        categoryName,
        remindDaysBefore: s.remindDaysBefore,
        note: s.note,
        cancelled: s.cancelledAt !== null,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function getSubscriptionOverview(
  db: Db,
  userId: string,
  today: DateString,
): Promise<SubscriptionOverview> {
  const all = await listSubscriptions(db, userId, today);
  const active = all.filter((s) => !s.cancelled);
  const monthlyMinor = active.reduce((sum, s) => sum + s.monthlyMinor, 0);
  return {
    active,
    cancelled: all.filter((s) => s.cancelled),
    monthlyMinor,
    yearlyMinor: monthlyMinor * 12,
    suggestions: await suggestSubscriptions(
      db,
      userId,
      today,
      all.map((s) => s.name),
    ),
  };
}

/** Son 120 günün giderlerinden abonelik adayları (zaten takip edilenler hariç). */
export async function suggestSubscriptions(
  db: Db,
  userId: string,
  today: DateString,
  tracked: string[],
) {
  const rows = await db
    .select({
      description: transactions.description,
      amountMinor: transactions.amountMinor,
      occurredOn: transactions.occurredOn,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryKey: categories.systemKey,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        isNull(transactions.deletedAt),
        gte(transactions.occurredOn, addDays(today, -DETECT_DAYS)),
      ),
    );
  return detectSubscriptions(
    rows.map(({ categoryName, ...r }) => ({ ...r, generic: r.description === categoryName })),
    tracked,
    today,
  ).slice(0, 5);
}

async function checkCategory(db: Db, userId: string, categoryId: string | null) {
  if (categoryId) await assertCategory(db, userId, categoryId, "expense", { allowArchived: true });
}

export async function createSubscription(
  db: Db,
  userId: string,
  input: SubscriptionInput,
  { currency, via = "manual" }: { currency: CurrencyCode; via?: "manual" | "ai" },
) {
  const data = subscriptionInputSchema.parse(input);
  await checkCategory(db, userId, data.categoryId);
  const [row] = await db
    .insert(subscriptions)
    .values({ ...data, userId, currency, createdVia: via })
    .returning({ id: subscriptions.id });
  return row!;
}

export async function updateSubscription(
  db: Db,
  userId: string,
  id: string,
  input: SubscriptionInput,
) {
  const data = subscriptionInputSchema.parse(input);
  await checkCategory(db, userId, data.categoryId);
  const [row] = await db
    .update(subscriptions)
    .set(data)
    .where(own(userId, id))
    .returning({ id: subscriptions.id });
  if (!row) throw new FinanceError("not_found");
  return row;
}

/** İptal edilen abonelik silinmez; geçmişte ne ödendiği görünsün ve geri alınabilsin. */
export async function setSubscriptionCancelled(
  db: Db,
  userId: string,
  id: string,
  cancelled: boolean,
  now = new Date(),
) {
  const [row] = await db
    .update(subscriptions)
    .set({ cancelledAt: cancelled ? now : null })
    .where(own(userId, id))
    .returning({ id: subscriptions.id });
  if (!row) throw new FinanceError("not_found");
  return row;
}

export async function deleteSubscription(db: Db, userId: string, id: string) {
  const [row] = await db
    .delete(subscriptions)
    .where(own(userId, id))
    .returning({ id: subscriptions.id });
  if (!row) throw new FinanceError("not_found");
  return row;
}

/* ----------------------------------------------------------- Bildirimler */

/** Yenilemeye remindDaysBefore gün (ya da daha az) kalan aktif abonelikler; her ödeme günü için bir kez. */
export async function subscriptionCandidates(
  db: Db,
  user: NotificationUser,
  today: DateString,
  money: (minor: number) => string,
): Promise<Candidate[]> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), isNull(subscriptions.cancelledAt)));
  const out: Candidate[] = [];
  for (const s of rows) {
    const next = nextChargeOn(s.nextChargeOn, s.cycle, today);
    const days = daysBetween(today, next);
    if (days > s.remindDaysBefore) continue;
    out.push({
      kind: "subscription_due",
      title:
        days === 0
          ? `${s.name} bugün yenileniyor`
          : days === 1
            ? `${s.name} yarın yenileniyor`
            : `${s.name} ${days} gün sonra yenileniyor`,
      body: `${money(s.amountMinor)} çekilecek. Kullanmıyorsan iptal etmenin tam zamanı.`,
      href: "/finance/subscriptions",
      dedupeKey: `sub:${s.id}:${next}`,
      priority: 2,
    });
  }
  return out;
}

/** Bugün yenilenecek aktif aboneliklerin sayısı ve toplamı (sabah özeti için). */
export async function subscriptionsDueOn(db: Db, userId: string, day: DateString) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), isNull(subscriptions.cancelledAt)));
  const due = rows.filter((s) => nextChargeOn(s.nextChargeOn, s.cycle, day) === day);
  return {
    count: due.length,
    totalMinor: due.reduce((sum, s) => sum + s.amountMinor, 0),
    names: due.map((s) => s.name),
  };
}

export const hasCancelledSubscription = async (db: Db, userId: string) =>
  (
    await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), isNotNull(subscriptions.cancelledAt)))
      .limit(1)
  ).length > 0;
