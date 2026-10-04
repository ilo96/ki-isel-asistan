import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import type { AchievementsView } from "@/server/services/achievements";
import { StreakWeek } from "./streak-week";

/** Ana sayfadaki seri kartı: bugünkü durum ve son 7 gün. Hiç kayıt yoksa görünmez. */
export async function StreakHomeCard({ data }: { data: AchievementsView }) {
  const t = await getTranslations("achievements");
  if (data.streak.best === 0) return null;
  const { current, activeToday } = data.streak;
  return (
    <Card className="relative transition-colors duration-[180ms] hover:border-accent/40">
      <Link
        href="/achievements"
        aria-label={t("title")}
        className="absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-accent"
      />
      <div className="flex items-center justify-between gap-2 text-small text-muted">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-warning" aria-hidden />
          <h2>{t("streakTitle")}</h2>
        </div>
        <span className="flex items-center gap-1">
          {t("badgeCount", { earned: data.earned, total: data.badges.length })}
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-h2 text-text tabular-nums">{t("days", { count: current })}</p>
      <p className="text-small text-muted">
        {activeToday
          ? t("todayDone")
          : current > 0
            ? t("todayPending", { next: current + 1 })
            : t("startAgain")}
      </p>
      <div className="mt-4">
        <StreakWeek week={data.week} label={t("weekLabel")} />
      </div>
    </Card>
  );
}
