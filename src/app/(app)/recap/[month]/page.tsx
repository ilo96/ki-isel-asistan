import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSwitcher } from "@/features/finance/month-switcher";
import { RecapView } from "@/features/recap/recap-view";
import { dayIn, DEFAULT_TIMEZONE, parseMonthKey } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMonthlyRecap } from "@/server/services/recap";

export const metadata: Metadata = { title: "Aylık özet" };

export default async function RecapPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!parseMonthKey(month)) notFound();
  const [user, t] = await Promise.all([requireUser(), getTranslations("recap")]);
  const today = dayIn(new Date(), user.timezone ?? DEFAULT_TIMEZONE);
  if (`${month}-01` > today) redirect(`/recap/${today.slice(0, 7)}`);
  const recap = await getMonthlyRecap(await getDb(), user.id, month, today);

  return (
    <>
      <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <MonthSwitcher
        month={month}
        hrefFor={(m) => `/recap/${m}`}
        className="mb-6 justify-center lg:justify-start"
      />
      {recap.isEmpty ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-h2 text-text">{t("emptyTitle")}</h2>
          <p className="mt-1 max-w-sm text-body text-muted">{t("emptyBody")}</p>
          <Link href="/home?ekle=gider" className="mt-5 text-small text-accent hover:underline">
            {t("emptyAction")}
          </Link>
        </div>
      ) : (
        <RecapView recap={recap} currency={(user.currency ?? DEFAULT_CURRENCY) as CurrencyCode} />
      )}
    </>
  );
}
