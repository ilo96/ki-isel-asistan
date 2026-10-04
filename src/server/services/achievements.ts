import { and, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  computeStreak,
  evaluateBadges,
  STREAK_MILESTONES,
  type AchievementStats,
  type BadgeState,
  type Streak,
} from "@/lib/achievements";
import { addDays, monthOf, shiftMonth, timeIn, type DateString } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import { budgets, reminders, subscriptions, transactions } from "@/server/db/schema";
import { getMonthBudgets } from "./budgets";
import { totalsBetween } from "./dashboard/totals";
import type { Candidate, NotificationUser } from "./notifications";

/*
 * Seriler ve rozetler: veriden hesaplanır. Bildirim yalnızca "taze" olaylar için gelir
 * (seri eşiği bugün aşıldı, geçen ay bütçede kalındı, akşam seri tehlikede); eski
 * rozetler sessizce ekranda görünür, yeni kullanıcıya bildirim yağmuru olmaz.
 */

const STREAK_WINDOW_DAYS = 400;
/** Akşam bu saatten sonra, seri sürüyorsa ve bugün bir şey girilmediyse hatırlatılır. */
export const STREAK_RISK_TIME = "20:00";
const STREAK_RISK_MIN = 3;

async function activeDays(db: Db, userId: string, today: DateString) {
  const rows = await db
    .selectDistinct({ day: transactions.occurredOn })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.occurredOn, addDays(today, -STREAK_WINDOW_DAYS)),
        lte(transactions.occurredOn, today),
      ),
    )
    .orderBy(desc(transactions.occurredOn));
  return rows.map((r) => r.day);
}

export async function getStreak(db: Db, userId: string, today: DateString): Promise<Streak> {
  return computeStreak(await activeDays(db, userId, today), today);
}

async function lastMonthResults(db: Db, userId: string, today: DateString) {
  const month = monthOf(`${shiftMonth(today.slice(0, 7), -1)}-01`);
  const [b, totals] = await Promise.all([
    getMonthBudgets(db, userId, month, today),
    totalsBetween({ db, userId, today }, month.start, month.end),
  ]);
  const lines = b.overall ? [b.overall] : b.lines;
  return {
    monthKey: month.start.slice(0, 7),
    budgetKept: lines.length > 0 && lines.every((l) => l.spentMinor <= l.limitMinor),
    saved: totals.income > 0 && totals.income > totals.expense,
  };
}

export async function getAchievementStats(db: Db, userId: string, today: DateString) {
  const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [streak, tx, ai, budgetCount, reminderCount, subs, last] = await Promise.all([
    getStreak(db, userId, today),
    n(
      db
        .select({ n: count() })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt))),
    ),
    n(
      db
        .select({ n: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
            eq(transactions.source, "ai"),
          ),
        ),
    ),
    n(db.select({ n: count() }).from(budgets).where(eq(budgets.userId, userId))),
    n(db.select({ n: count() }).from(reminders).where(eq(reminders.userId, userId))),
    db
      .select({
        total: count(),
        cancelled: sql<number>`count(${subscriptions.cancelledAt})::int`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId)),
    lastMonthResults(db, userId, today),
  ]);
  const stats: AchievementStats = {
    transactionCount: tx,
    aiTransactionCount: ai,
    streak,
    hasBudget: budgetCount > 0,
    hasReminder: reminderCount > 0,
    budgetKeptLastMonth: last.budgetKept,
    savedLastMonth: last.saved,
    subscriptionCount: subs[0]?.total ?? 0,
    cancelledSubscription: (subs[0]?.cancelled ?? 0) > 0,
  };
  return { stats, lastMonthKey: last.monthKey };
}

export type AchievementsView = {
  streak: Streak;
  /** Son 7 gün, eskiden yeniye: o gün işlem girildi mi. */
  week: { day: DateString; active: boolean }[];
  badges: BadgeState[];
  earned: number;
};

export async function getAchievements(
  db: Db,
  userId: string,
  today: DateString,
): Promise<AchievementsView> {
  const [{ stats }, days] = await Promise.all([
    getAchievementStats(db, userId, today),
    activeDays(db, userId, today),
  ]);
  const set = new Set(days);
  const badges = evaluateBadges(stats);
  return {
    streak: stats.streak,
    week: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      return { day, active: set.has(day) };
    }),
    badges,
    earned: badges.filter((b) => b.earned).length,
  };
}

/* ----------------------------------------------------------- Bildirimler */

export async function achievementCandidates(
  db: Db,
  user: NotificationUser,
  today: DateString,
  now: Date,
): Promise<Candidate[]> {
  const { stats, lastMonthKey } = await getAchievementStats(db, user.id, today);
  const out: Candidate[] = [];
  const { streak } = stats;

  // Eşik bugün aşıldıysa (seri bugünkü kayıtla bu sayıya ulaştı) kutla.
  const milestone = STREAK_MILESTONES.find((m) => m === streak.current);
  if (streak.activeToday && milestone) {
    out.push({
      kind: "achievement",
      title: `${milestone} günlük seri! 🔥`,
      body: `${milestone} gündür harcamalarını kaydediyorsun. Böyle devam!`,
      href: "/achievements",
      dedupeKey: `streak:${milestone}:${today}`,
      priority: 4,
    });
  }

  if (
    !streak.activeToday &&
    streak.current >= STREAK_RISK_MIN &&
    timeIn(now, user.timezone) >= STREAK_RISK_TIME
  ) {
    out.push({
      kind: "achievement",
      title: "Serini kaybetme",
      body: `${streak.current} günlük serin var. Bugünün harcamalarını girersen devam eder.`,
      href: "/home",
      dedupeKey: `streak-risk:${today}`,
      priority: 4,
    });
  }

  // Ayın ilk haftası: geçen ayın sonucu.
  if (Number(today.slice(8, 10)) <= 7) {
    if (stats.budgetKeptLastMonth) {
      out.push({
        kind: "achievement",
        title: "Rozet: Bütçede kaldın 🛡️",
        body: "Geçen ayı bütçeni aşmadan kapattın.",
        href: "/achievements",
        dedupeKey: `badge:budget_kept:${lastMonthKey}`,
        priority: 4,
      });
    }
    if (stats.savedLastMonth) {
      out.push({
        kind: "achievement",
        title: "Rozet: Artıda kapattın 🐷",
        body: "Geçen ay gelirin giderinden fazlaydı. Aylık özetine göz at!",
        href: `/recap/${lastMonthKey}`,
        dedupeKey: `badge:saver:${lastMonthKey}`,
        priority: 4,
      });
    }
  }
  return out;
}
