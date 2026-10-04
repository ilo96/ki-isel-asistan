import { and, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { addDays, dayIn, monthOf, timeIn, zonedDateTime, type DateString } from "@/lib/dates";
import { buildDigest, inDigestWindow } from "@/lib/daily-digest";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { SettingsInput } from "@/lib/validation/settings";
import type { Db } from "@/server/db/client";
import { notifications, reminders, transactions, type Notification } from "@/server/db/schema";
import { achievementCandidates, getStreak } from "./achievements";
import { getMonthBudgets, type MonthBudgets } from "./budgets";
import { totalsBetween } from "./dashboard/totals";
import { fitnessCandidates } from "./fitness-notifications";
import { getSettings } from "./settings";
import { subscriptionCandidates, subscriptionsDueOn } from "./subscriptions";

/*
 * Bildirim üretimi (plan: Bildirim stratejisi). Her çalıştırmada adaylar yeniden hesaplanır;
 * dedupe_key aynı olayın ikinci kez yazılmasını engeller. Öncelik: sabah özeti > ödeme >
 * hatırlatıcı ve abonelik > bütçe > rozet ve haftalık özet. Sessiz saatlerde hiçbir şey üretilmez (sonraki çalıştırmada gelir),
 * günlük sınır kullanıcının gününe göre sayılır.
 */

export type NotificationUser = { id: string; timezone: string; currency: CurrencyCode; name?: string | null };

export type Candidate = Pick<Notification, "kind" | "title" | "body" | "href" | "dedupeKey" | "priority">;

const REMINDER_LEAD_MS = 60 * 60_000;
const OVERDUE_LOOKBACK_DAYS = 7;
const WEEKLY_DAY = 1; // pazartesi
const WEEKLY_TIME = "09:00";

/** "22:00–08:00" gibi gece yarısını aşan aralıklar dahil. */
export function inQuietHours(time: string, start: string, end: string) {
  if (start === end) return false;
  return start < end ? time >= start && time < end : time >= start || time < end;
}

export async function buildCandidates(
  db: Db,
  user: NotificationUser,
  settings: SettingsInput,
  now: Date,
): Promise<Candidate[]> {
  const tz = user.timezone;
  const today = dayIn(now, tz);
  const money = (minor: number) => formatMoney(minor, { currency: user.currency, compact: true });
  const out: Candidate[] = [];

  if (settings.notifyBills || settings.notifyReminders) {
    const endOfTomorrow = zonedDateTime(addDays(today, 2), "00:00", tz);
    const since = zonedDateTime(addDays(today, -OVERDUE_LOOKBACK_DAYS), "00:00", tz);
    const rows = await db
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.userId, user.id),
          isNull(reminders.deletedAt),
          isNull(reminders.completedAt),
          gte(reminders.dueAt, since),
          lt(reminders.dueAt, endOfTomorrow),
        ),
      );
    for (const r of rows) {
      if (r.snoozedUntil && r.snoozedUntil > now) continue;
      const day = dayIn(r.dueAt, tz);
      if (r.kind === "bill") {
        if (!settings.notifyBills) continue;
        const overdue = day < today;
        const title = overdue
          ? `${r.title} ödemesi gecikti`
          : day === today
            ? `${r.title} bugün ödenecek`
            : `${r.title} yarın ödenecek`;
        out.push({
          kind: "bill_due",
          title,
          body: r.amountMinor ? `Tutar: ${money(r.amountMinor)}` : "Ödediğinde Görevler'den işaretleyebilirsin.",
          href: "/tasks",
          dedupeKey: `bill:${r.id}:${day}:${overdue ? "late" : "soon"}`,
          priority: 1,
        });
      } else if (settings.notifyReminders) {
        const lead = r.dueAt.getTime() - now.getTime();
        // Saatli olanlar bir saat kala, tüm gün olanlar gününde.
        const due = r.allDay ? day <= today : lead <= REMINDER_LEAD_MS;
        if (!due || day < addDays(today, -1)) continue;
        out.push({
          kind: "reminder_due",
          title: r.title,
          body: r.allDay ? "Bugün" : `Saat ${timeIn(r.dueAt, tz)}`,
          href: "/tasks",
          dedupeKey: `reminder:${r.id}:${r.dueAt.toISOString()}`,
          priority: 2,
        });
      }
    }
  }

  const month = monthOf(today);
  const b = await getMonthBudgets(db, user.id, month, today);

  if (settings.notifyDaily && inDigestWindow(timeIn(now, tz), settings.dailyTime)) {
    const digest = await dailyDigest(db, user, today, b, money);
    if (digest) out.push(digest);
  }

  if (settings.notifySubscriptions) out.push(...(await subscriptionCandidates(db, user, today, money)));
  if (settings.notifyAchievements) out.push(...(await achievementCandidates(db, user, today, now)));

  if (settings.notifyBudget) {
    const lines = [...(b.overall ? [b.overall] : []), ...b.lines];
    for (const l of lines) {
      const threshold = l.ratio >= 1 ? 100 : l.ratio >= 0.8 ? 80 : null;
      if (!threshold) continue;
      const name = l.categoryId ? `${l.name} bütçesi` : "Aylık bütçen";
      out.push({
        kind: "budget_threshold",
        title: threshold === 100 ? `${name} aşıldı` : `${name} %80'e ulaştı`,
        body: `${money(l.spentMinor)} / ${money(l.limitMinor)} · ${b.daysLeft} gün kaldı`,
        href: "/finance/budgets",
        dedupeKey: `budget:${month.start.slice(0, 7)}:${l.categoryId ?? "all"}:${threshold}`,
        priority: 3,
      });
    }
  }

  if (settings.notifyWeekly && weekday(today) === WEEKLY_DAY && timeIn(now, tz) >= WEEKLY_TIME) {
    const ctx = { db, userId: user.id, today };
    const [last, before] = await Promise.all([
      totalsBetween(ctx, addDays(today, -7), addDays(today, -1)),
      totalsBetween(ctx, addDays(today, -14), addDays(today, -8)),
    ]);
    if (last.expense > 0) {
      const change = before.expense > 0 ? Math.round(((last.expense - before.expense) / before.expense) * 100) : null;
      out.push({
        kind: "weekly_summary",
        title: "Haftalık özet",
        body:
          `Geçen hafta ${money(last.expense)} harcadın` +
          (change !== null && Math.abs(change) >= 5
            ? `, önceki haftadan %${Math.abs(change)} ${change < 0 ? "az" : "fazla"}.`
            : "."),
        href: "/finance",
        dedupeKey: `weekly:${today}`,
        priority: 4,
      });
    }
  }

  // Eklentilerin bildirimleri en düşük öncelikle gelir; günlük sınır önce asıl işlere yeter.
  out.push(...(await fitnessCandidates(db, user, today, now)));

  return out.sort((a, b) => a.priority - b.priority);
}

const weekday = (day: DateString) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Sabah özeti: bugünün ödemeleri, en sıkışık bütçe, dün ya da seri. */
async function dailyDigest(
  db: Db,
  user: NotificationUser,
  today: DateString,
  budgets: MonthBudgets,
  money: (minor: number) => string,
): Promise<Candidate | null> {
  const tz = user.timezone;
  const ctx = { db, userId: user.id, today };
  const [dueToday, subs, yesterday, streak, [any]] = await Promise.all([
    db
      .select({ kind: reminders.kind, amountMinor: reminders.amountMinor })
      .from(reminders)
      .where(
        and(
          eq(reminders.userId, user.id),
          isNull(reminders.deletedAt),
          isNull(reminders.completedAt),
          gte(reminders.dueAt, zonedDateTime(today, "00:00", tz)),
          lt(reminders.dueAt, zonedDateTime(addDays(today, 1), "00:00", tz)),
        ),
      ),
    subscriptionsDueOn(db, user.id, today),
    totalsBetween(ctx, addDays(today, -1), addDays(today, -1)),
    getStreak(db, user.id, today),
    db.select({ n: count() }).from(transactions).where(eq(transactions.userId, user.id)),
  ]);
  const bills = dueToday.filter((r) => r.kind === "bill");
  const lines = [...(budgets.overall ? [budgets.overall] : []), ...budgets.lines];
  const open = lines.filter((l) => l.ratio < 1).sort((a, c) => c.ratio - a.ratio)[0];
  const digest = buildDigest(
    {
      firstName: user.name?.split(" ")[0] ?? null,
      bills: { count: bills.length, totalMinor: bills.reduce((s, r) => s + (r.amountMinor ?? 0), 0) },
      subscriptions: subs,
      reminders: dueToday.length - bills.length,
      tightestBudget: open ? { name: open.categoryId ? open.name : null, leftMinor: open.limitMinor - open.spentMinor } : null,
      overBudgets: lines.filter((l) => l.ratio >= 1).length,
      yesterdayExpenseMinor: yesterday.expense,
      streak: streak.current,
      hasData: (any?.n ?? 0) > 0 || dueToday.length > 0 || subs.count > 0,
    },
    money,
  );
  if (!digest) return null;
  return { kind: "daily_digest", ...digest, href: "/home", dedupeKey: `daily:${today}`, priority: 0 };
}

/** Adayları sınırlar içinde yazar; yeni yazılanları döndürür (push için). */
export async function generateNotifications(db: Db, user: NotificationUser, now = new Date()) {
  const settings = await getSettings(db, user.id);
  if (inQuietHours(timeIn(now, user.timezone), settings.quietStart, settings.quietEnd)) return [];

  const candidates = await buildCandidates(db, user, settings, now);
  if (candidates.length === 0) return [];

  const dayStart = zonedDateTime(dayIn(now, user.timezone), "00:00", user.timezone);
  const [existing, [sent]] = await Promise.all([
    db
      .select({ key: notifications.dedupeKey })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          inArray(
            notifications.dedupeKey,
            candidates.map((c) => c.dedupeKey),
          ),
        ),
      ),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), gte(notifications.createdAt, dayStart))),
  ]);
  const known = new Set(existing.map((e) => e.key));
  const room = Math.max(0, settings.dailyLimit - (sent?.n ?? 0));
  const fresh = candidates.filter((c) => !known.has(c.dedupeKey)).slice(0, room);
  if (fresh.length === 0) return [];

  return db
    .insert(notifications)
    .values(fresh.map((c) => ({ ...c, userId: user.id, createdAt: now })))
    .onConflictDoNothing()
    .returning();
}

/* --------------------------------------------------------------- Okuma */

export async function listNotifications(db: Db, userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(db: Db, userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markRead(db: Db, userId: string, id: string | "all", now = new Date()) {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        id === "all" ? undefined : eq(notifications.id, id),
      ),
    );
}
