import { and, asc, desc, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";
import { addDays, dayIn, zonedDateTime } from "@/lib/dates";
import type { LifeItem } from "@/lib/life/types";
import type { LifeTab } from "@/lib/validation/life";
import type { Db } from "@/server/db/client";
import { reminders, tasks } from "@/server/db/schema";
import { toLifeItem } from "./reminders";
import { taskToLifeItem } from "./tasks";

/*
 * Görevler ekranının üç sekmesi:
 *  - Bugün: gecikmiş + bugünkü hatırlatıcılar ve görevler, tarihsiz görevler.
 *  - Yaklaşan: yarından itibaren 60 gün.
 *  - Tamamlanan: son 30 gün, en yeni üstte.
 */

export const UPCOMING_WINDOW_DAYS = 60;
export const DONE_WINDOW_DAYS = 30;
const LIMIT = 200;

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/** Gecikmişler önce, sonra tarih/saat, aynı anda olanlarda öncelik. Tarihsiz görevler sonda. */
function sortOpen(a: LifeItem, b: LifeItem) {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const ak = `${a.date ?? "9999"}T${(a.type === "reminder" && a.time) || "99:99"}`;
  const bk = `${b.date ?? "9999"}T${(b.type === "reminder" && b.time) || "99:99"}`;
  if (ak !== bk) return ak < bk ? -1 : 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

export type LifeCounts = Record<LifeTab, number>;

export async function getLifeItems(
  db: Db,
  user: { id: string; timezone: string },
  tab: LifeTab,
  now = new Date(),
): Promise<LifeItem[]> {
  const tz = user.timezone;
  const today = dayIn(now, tz);
  const tomorrowStart = zonedDateTime(addDays(today, 1), "00:00", tz);
  const reminderAlive = and(eq(reminders.userId, user.id), isNull(reminders.deletedAt));
  const taskAlive = and(eq(tasks.userId, user.id), isNull(tasks.deletedAt));

  if (tab === "done") {
    const since = new Date(now.getTime() - DONE_WINDOW_DAYS * 86_400_000);
    const [r, t] = await Promise.all([
      db
        .select()
        .from(reminders)
        .where(and(reminderAlive, gte(reminders.completedAt, since)))
        .orderBy(desc(reminders.completedAt))
        .limit(LIMIT),
      db
        .select()
        .from(tasks)
        .where(and(taskAlive, gte(tasks.completedAt, since)))
        .orderBy(desc(tasks.completedAt))
        .limit(LIMIT),
    ]);
    return [
      ...r.map((x) => toLifeItem(x, tz, now)),
      ...t.map((x) => taskToLifeItem(x, today)),
    ].sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1));
  }

  if (tab === "today") {
    const [r, t] = await Promise.all([
      db
        .select()
        .from(reminders)
        .where(
          and(reminderAlive, isNull(reminders.completedAt), lt(reminders.dueAt, tomorrowStart)),
        )
        .orderBy(asc(reminders.dueAt))
        .limit(LIMIT),
      db
        .select()
        .from(tasks)
        .where(
          and(
            taskAlive,
            isNull(tasks.completedAt),
            or(isNull(tasks.dueOn), lt(tasks.dueOn, addDays(today, 1))),
          ),
        )
        .orderBy(asc(tasks.sortOrder))
        .limit(LIMIT),
    ]);
    return [
      ...r.map((x) => toLifeItem(x, tz, now)),
      ...t.map((x) => taskToLifeItem(x, today)),
    ].sort(sortOpen);
  }

  const until = zonedDateTime(addDays(today, UPCOMING_WINDOW_DAYS + 1), "00:00", tz);
  const [r, t] = await Promise.all([
    db
      .select()
      .from(reminders)
      .where(
        and(
          reminderAlive,
          isNull(reminders.completedAt),
          gte(reminders.dueAt, tomorrowStart),
          lt(reminders.dueAt, until),
        ),
      )
      .orderBy(asc(reminders.dueAt))
      .limit(LIMIT),
    db
      .select()
      .from(tasks)
      .where(
        and(
          taskAlive,
          isNull(tasks.completedAt),
          isNotNull(tasks.dueOn),
          gte(tasks.dueOn, addDays(today, 1)),
          lt(tasks.dueOn, addDays(today, UPCOMING_WINDOW_DAYS + 1)),
        ),
      )
      .limit(LIMIT),
  ]);
  return [...r.map((x) => toLifeItem(x, tz, now)), ...t.map((x) => taskToLifeItem(x, today))].sort(
    sortOpen,
  );
}

/** Sekme rozetleri için açık iş sayıları (tamamlanan sayılmaz). */
export async function getLifeCounts(
  db: Db,
  user: { id: string; timezone: string },
  now = new Date(),
): Promise<Pick<LifeCounts, "today" | "upcoming">> {
  const [today, upcoming] = await Promise.all([
    getLifeItems(db, user, "today", now),
    getLifeItems(db, user, "upcoming", now),
  ]);
  return { today: today.length, upcoming: upcoming.length };
}
