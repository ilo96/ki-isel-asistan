import { daysBetween, timeIn, type DateString } from "@/lib/dates";
import { fitnessSettingsSchema, DEFAULT_FITNESS_SETTINGS } from "@/lib/validation/fitness";
import type { Db } from "@/server/db/client";
import { getActiveGoal, getGoalView, listWorkouts, weekOf, weightOn } from "./fitness";
import { getModuleState } from "./modules";
import type { Candidate, NotificationUser } from "./notifications";

/*
 * Spor & Sağlık bildirimleri; eklenti kapalıysa hiçbiri üretilmez. Sıklık bilinçli olarak
 * düşük: tartı ve hedef haftada bir (pazartesi), spor hatırlatması (varsayılan kapalı) bir
 * aradan sonra bir kez. Bildirimler push ile kilit ekranına da düşebildiği için kilo değeri içermez.
 */

const PRIORITY = 5;
const WEEKLY_DAY = 1;
const WEEKLY_TIME = "09:00";
const WEIGH_IN_GAP_DAYS = 7;
const WORKOUT_GAP_DAYS = 4;

export async function fitnessCandidates(
  db: Db,
  user: NotificationUser,
  today: DateString,
  now: Date,
): Promise<Candidate[]> {
  const state = await getModuleState(db, user.id, "fitness");
  if (!state.enabled) return [];
  const parsed = fitnessSettingsSchema.safeParse(state.settings);
  const settings = parsed.success ? parsed.data : DEFAULT_FITNESS_SETTINGS;
  const weekly =
    new Date(`${today}T12:00:00Z`).getUTCDay() === WEEKLY_DAY &&
    timeIn(now, user.timezone) >= WEEKLY_TIME;
  const week = weekOf(today).start;
  const out: Candidate[] = [];

  if (settings.notifyWeighIn && weekly) {
    const last = await weightOn(db, user.id, today);
    if (last && daysBetween(last.date, today) >= WEIGH_IN_GAP_DAYS) {
      out.push({
        kind: "fitness",
        title: "Haftalık tartı zamanı",
        body: `Son ölçümün ${daysBetween(last.date, today)} gün önceydi. Asistana kilonu yazman yeterli.`,
        href: "/fitness",
        dedupeKey: `fitness:weigh:${week}`,
        priority: PRIORITY,
      });
    }
  }

  if (settings.notifyWorkout) {
    const [last] = await listWorkouts(db, user.id, { to: today, limit: 1 });
    if (last && daysBetween(last.date, today) >= WORKOUT_GAP_DAYS) {
      out.push({
        kind: "fitness",
        title: "Biraz hareket?",
        body: `Son aktiviten ${daysBetween(last.date, today)} gün önceydi. Kısa bir yürüyüş de sayılır.`,
        href: "/fitness",
        dedupeKey: `fitness:move:${last.date}`,
        priority: PRIORITY,
      });
    }
  }

  if (settings.notifyGoal && weekly && (await getActiveGoal(db, user.id))) {
    const goal = await getGoalView(db, user.id, today);
    if (goal && !goal.progress.reached) {
      out.push({
        kind: "fitness",
        title: "Hedef ilerlemen",
        body: `Hedefinin %${Math.round(goal.progress.ratio * 100)}'i tamam. Ayrıntılar Spor & Sağlık'ta.`,
        href: "/fitness",
        dedupeKey: `fitness:goal:${week}`,
        priority: PRIORITY,
      });
    }
  }
  return out;
}
