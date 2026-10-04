import { Crown, Flame, Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { BadgeIcon } from "@/features/achievements/badge-icon";
import { StreakWeek } from "@/features/achievements/streak-week";
import { cn } from "@/lib/cn";
import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { getAchievements } from "@/server/services/achievements";

export const metadata: Metadata = { title: "Seriler ve rozetler" };

export default async function AchievementsPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("achievements")]);
  const today = dayIn(new Date(), user.timezone ?? DEFAULT_TIMEZONE);
  const data = await getAchievements(await getDb(), user.id, today);
  const { current, best, activeToday } = data.streak;
  const earned = data.badges.filter((b) => b.earned);
  const locked = data.badges.filter((b) => !b.earned);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-warning-soft">
              <Flame className="size-8 text-warning" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-display text-text tabular-nums">{t("days", { count: current })}</p>
              <p className="text-small text-muted">
                {activeToday
                  ? t("todayDone")
                  : current > 0
                    ? t("todayPending", { next: current + 1 })
                    : t("startAgain")}
              </p>
            </div>
            <div className="ml-auto hidden text-right sm:block">
              <p className="flex items-center justify-end gap-1.5 text-caption text-muted">
                <Crown className="size-3.5" aria-hidden />
                {t("best")}
              </p>
              <p className="text-h2 text-text tabular-nums">{t("days", { count: best })}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-border/60 pt-5">
            <StreakWeek week={data.week} label={t("weekLabel")} />
          </div>
          <p className="mt-4 text-caption text-muted sm:hidden">{t("bestLine", { count: best })}</p>
          <p className="mt-2 text-caption text-muted">{t("howStreak")}</p>
        </Card>

        <section>
          <h2 className="mb-3 text-h2 text-text">
            {t("badges")}{" "}
            <span className="text-muted tabular-nums">
              {t("badgeCount", { earned: data.earned, total: data.badges.length })}
            </span>
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...earned, ...locked].map((b) => (
              <li
                key={b.key}
                className={cn(
                  "flex flex-col items-center rounded-card border p-4 text-center",
                  b.earned
                    ? "border-transparent bg-surface shadow-card"
                    : "border-dashed border-border bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "relative grid size-14 place-items-center rounded-full",
                    b.earned
                      ? "ai-gradient text-white shadow-raised"
                      : "bg-surface-muted text-muted",
                  )}
                >
                  <BadgeIcon icon={b.icon} className="size-6" />
                  {!b.earned && (
                    <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-surface text-muted shadow-card">
                      <Lock className="size-3" aria-hidden />
                    </span>
                  )}
                </span>
                <p
                  className={cn(
                    "mt-3 text-small font-medium",
                    b.earned ? "text-text" : "text-muted",
                  )}
                >
                  {t(`list.${b.key}.title`)}
                </p>
                <p className="mt-0.5 text-caption text-muted">{t(`list.${b.key}.body`)}</p>
                {!b.earned && b.progress && b.progress.target > 1 && (
                  <div className="mt-3 w-full">
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(b.progress.value / b.progress.target) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-caption text-muted tabular-nums">
                      {b.progress.value} / {b.progress.target}
                    </p>
                  </div>
                )}
                <span className="sr-only">{b.earned ? t("earned") : t("locked")}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
