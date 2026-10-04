import { addDays, type DateString } from "@/lib/dates";

/*
 * Seriler ve rozetler (saf fonksiyonlar). Seri: üst üste işlem girilen günler; bugün henüz
 * bir şey girilmediyse dünkü seri hâlâ sürüyor sayılır (gün bitene kadar kurtarılabilir).
 * Rozetler veriden hesaplanır, ayrı bir tabloda saklanmaz: veri silinirse rozet de gider.
 */

export type Streak = { current: number; best: number; activeToday: boolean };

/** days: işlem girilen takvim günleri (sıra ve tekrar önemli değil). */
export function computeStreak(days: readonly DateString[], today: DateString): Streak {
  const set = new Set(days.filter((d) => d <= today));
  const activeToday = set.has(today);
  let current = 0;
  for (let d = activeToday ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current++;

  let best = 0;
  let run = 0;
  let prev: DateString | null = null;
  for (const d of [...set].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), activeToday };
}

export type AchievementStats = {
  transactionCount: number;
  aiTransactionCount: number;
  streak: Streak;
  hasBudget: boolean;
  hasReminder: boolean;
  /** Geçen ay bütçe vardı ve aşılmadı. */
  budgetKeptLastMonth: boolean;
  /** Geçen ay gelir giderden fazlaydı. */
  savedLastMonth: boolean;
  subscriptionCount: number;
  cancelledSubscription: boolean;
};

export type BadgeKey =
  | "first_step"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "tx_50"
  | "tx_250"
  | "budget_set"
  | "budget_kept"
  | "saver"
  | "planner"
  | "assistant_friend"
  | "sub_tracker"
  | "sub_hunter";

export type BadgeDef = {
  key: BadgeKey;
  /** lucide ikon adı; arayüz eşler. */
  icon: string;
  /** İlerleme gösterilebilen rozetlerde hedef ve mevcut değer. */
  progress?: (s: AchievementStats) => { value: number; target: number };
  earned: (s: AchievementStats) => boolean;
};

const count = (
  target: number,
  pick: (s: AchievementStats) => number,
): Pick<BadgeDef, "progress" | "earned"> => ({
  progress: (s) => ({ value: Math.min(pick(s), target), target }),
  earned: (s) => pick(s) >= target,
});

export const BADGES: readonly BadgeDef[] = [
  { key: "first_step", icon: "sparkles", ...count(1, (s) => s.transactionCount) },
  { key: "streak_3", icon: "flame", ...count(3, (s) => s.streak.best) },
  { key: "streak_7", icon: "flame", ...count(7, (s) => s.streak.best) },
  { key: "streak_30", icon: "crown", ...count(30, (s) => s.streak.best) },
  { key: "tx_50", icon: "notebook", ...count(50, (s) => s.transactionCount) },
  { key: "tx_250", icon: "library", ...count(250, (s) => s.transactionCount) },
  { key: "budget_set", icon: "target", earned: (s) => s.hasBudget },
  { key: "budget_kept", icon: "shield-check", earned: (s) => s.budgetKeptLastMonth },
  { key: "saver", icon: "piggy-bank", earned: (s) => s.savedLastMonth },
  { key: "planner", icon: "bell", earned: (s) => s.hasReminder },
  { key: "assistant_friend", icon: "bot", ...count(5, (s) => s.aiTransactionCount) },
  { key: "sub_tracker", icon: "repeat", ...count(3, (s) => s.subscriptionCount) },
  { key: "sub_hunter", icon: "scissors", earned: (s) => s.cancelledSubscription },
];

export type BadgeState = {
  key: BadgeKey;
  icon: string;
  earned: boolean;
  progress: { value: number; target: number } | null;
};

export function evaluateBadges(stats: AchievementStats): BadgeState[] {
  return BADGES.map((b) => ({
    key: b.key,
    icon: b.icon,
    earned: b.earned(stats),
    progress: b.progress ? b.progress(stats) : null,
  }));
}

/** Kutlama bildirimi gönderilen seri eşikleri. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
