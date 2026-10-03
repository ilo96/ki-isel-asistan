import { Bell, ChevronRight, Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Amount } from "@/components/ui/amount";
import { Card, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { MemoryList } from "@/features/settings/memory-list";
import { getDb } from "@/server/db";
import { listMemoryRows } from "@/server/services/account";
import type { CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const [t, tOnboarding, user] = await Promise.all([
    getTranslations("profile"),
    getTranslations("onboarding.currencies"),
    requireUser(),
  ]);
  const currency = user.currency as CurrencyCode;
  const memories = await listMemoryRows(await getDb(), user.id);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <span
              className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-h2 text-accent"
              aria-hidden
            >
              {user.name.charAt(0).toLocaleUpperCase("tr-TR")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-h2 text-text">{user.name}</p>
              <p className="truncate text-small text-muted">{user.email}</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
            <div>
              <dt className="text-caption text-muted">{t("currency")}</dt>
              <dd className="mt-1 text-body text-text">{tOnboarding(currency)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted">{t("monthlyIncome")}</dt>
              <dd className="mt-1 text-body text-text">
                {user.monthlyIncomeMinor ? (
                  <Amount minor={user.monthlyIncomeMinor} currency={currency} compact />
                ) : (
                  <span className="text-muted">{t("notSet")}</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>
        <MemoryList items={memories.map((m) => ({ id: m.id, content: m.content }))} />
        <Card>
          <CardTitle>{t("appearance")}</CardTitle>
          <p className="mt-1 mb-4 text-small text-muted">{t("appearanceBody")}</p>
          <ThemeToggle withLabels />
        </Card>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-card border border-border/60 bg-surface p-5 text-text shadow-card transition-colors hover:border-accent/40 dark:border-transparent"
        >
          <Bell className="size-5 text-accent" aria-hidden />
          <span className="flex-1">{t("settingsLink")}</span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
        <Link
          href="/dev/components"
          className="flex items-center gap-3 rounded-card border border-border/60 bg-surface p-5 text-text shadow-card transition-colors hover:border-accent/40 dark:border-transparent"
        >
          <Palette className="size-5 text-accent" aria-hidden />
          <span className="flex-1">{t("componentsLink")}</span>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </Link>
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>{t("account")}</CardTitle>
            <p className="mt-1 text-small text-muted">{t("signOutBody")}</p>
          </div>
          <SignOutButton />
        </Card>
      </div>
    </>
  );
}
