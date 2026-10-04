import { Bot, Camera, Flame, Mic, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { Amount } from "@/components/ui/amount";
import { APP_NAME } from "@/config/brand";
import { cn } from "@/lib/cn";
import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { getStreak } from "@/server/services/achievements";
import { getDashboard } from "@/server/services/dashboard";
import { totalsBetween } from "@/server/services/dashboard/totals";

export const metadata: Metadata = {
  title: "Hızlı panel",
  manifest: "/widget.webmanifest",
  appleWebApp: { capable: true, title: `${APP_NAME} Panel` },
};
export const dynamic = "force-dynamic";

/**
 * Hızlı panel: telefonda ana ekrana ayrı simge olarak eklenen, widget gibi tek bakışta
 * bugünü gösteren sayfa. Düğmeler uygulamayı doğrudan sesle ekleme, fiş ya da gider
 * formunda açar. Uygulama kabuğu (menüler) bilinçli olarak yok.
 */
export default async function WidgetPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("widget")]);
  const tz = user.timezone ?? DEFAULT_TIMEZONE;
  const today = dayIn(new Date(), tz);
  const currency = (user.currency ?? DEFAULT_CURRENCY) as CurrencyCode;
  const db = await getDb();
  const [data, streak, todayTotals] = await Promise.all([
    getDashboard(db, { id: user.id, timezone: tz }),
    getStreak(db, user.id, today),
    totalsBetween({ db, userId: user.id, today }, today, today),
  ]);
  const next = data.upcoming.find((u) => !u.overdue);
  const budgetLeft = data.budget ? data.budget.limitMinor - data.budget.spentMinor : null;

  const actions = [
    { href: "/home?ekle=ses", icon: Mic, label: t("voice"), primary: true },
    { href: "/home?ekle=fis", icon: Camera, label: t("receipt") },
    { href: "/home?ekle=gider", icon: Plus, label: t("expense") },
    { href: "/assistant", icon: Bot, label: t("assistant") },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-bg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2.5 pt-2">
        <AssistantOrb size="sm" />
        <span className="text-body font-semibold text-text">{APP_NAME}</span>
        {streak.current > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-caption text-warning">
            <Flame className="size-3.5" aria-hidden />
            {t("streak", { count: streak.current })}
          </span>
        )}
      </header>

      <section className="rounded-card bg-surface p-5 shadow-card">
        <p className="text-caption text-muted">{t("today")}</p>
        <p className="mt-1 text-display text-text">
          <Amount minor={todayTotals.expense} currency={currency} compact />
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
          <div>
            <dt className="text-caption text-muted">{t("month")}</dt>
            <dd className="mt-0.5 text-body font-semibold text-text">
              <Amount minor={data.expenseMinor} currency={currency} compact />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-muted">{t("budgetLeft")}</dt>
            <dd
              className={cn(
                "mt-0.5 text-body font-semibold",
                budgetLeft !== null && budgetLeft < 0 ? "text-negative" : "text-text",
              )}
            >
              {budgetLeft === null ? (
                <span className="text-muted">{t("noBudget")}</span>
              ) : (
                <Amount minor={budgetLeft} currency={currency} compact />
              )}
            </dd>
          </div>
        </dl>
        {next && (
          <p className="mt-4 rounded-input bg-surface-muted px-3.5 py-2.5 text-small text-text">
            {next.daysUntil === 0
              ? t("nextToday", { title: next.title })
              : t("nextIn", { title: next.title, days: next.daysUntil })}
          </p>
        )}
      </section>

      <nav aria-label={t("actions")} className="grid grid-cols-2 gap-3">
        {actions.map(({ href, icon: Icon, label, primary }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex h-24 flex-col items-center justify-center gap-2 rounded-card text-small font-medium shadow-card transition-transform active:scale-[0.97]",
              primary ? "ai-gradient text-white" : "bg-surface text-text",
            )}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <p className="mt-auto text-center text-caption text-muted">{t("hint")}</p>
    </main>
  );
}
