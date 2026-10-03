import { ArrowRight, Plus, ReceiptText, Scale, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/features/dashboard/stat-card";
import { CategoryBreakdown } from "@/features/finance/category-breakdown";
import { DayGroups } from "@/features/finance/day-groups";
import { FinanceTabs } from "@/features/finance/finance-tabs";
import { MonthSwitcher } from "@/features/finance/month-switcher";
import { financePageContext } from "@/features/finance/page-context";
import { formatMoney } from "@/lib/money";
import { getMonthOverview, type MonthOverview } from "@/server/services/finance-overview";
import { countTransactions, listTransactions } from "@/server/services/transactions";

export const metadata: Metadata = { title: "Finans" };

const RECENT_LIMIT = 6;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FinancePage({ searchParams }: Props) {
  const t = await getTranslations("finance");
  const ctx = await financePageContext((await searchParams).month);
  const { db, userId, currency, today, month, range } = ctx;

  const [total, overview, recent] = await Promise.all([
    countTransactions(db, userId),
    getMonthOverview(db, userId, range, today),
    listTransactions(db, userId, { ...range, limit: RECENT_LIMIT }),
  ]);

  const header = (
    <PageHeader
      title={t("title")}
      subtitle={t("subtitle")}
      action={
        <QuickAddButton className="hidden sm:inline-flex">
          <Plus aria-hidden />
          {t("addTransaction")}
        </QuickAddButton>
      }
    />
  );

  if (total === 0) {
    return (
      <>
        {header}
        <FinanceTabs />
        <Card>
          <EmptyState
            icon={ReceiptText}
            title={t("emptyTitle")}
            description={t("emptyBody")}
            action={
              <QuickAddButton>
                <Plus aria-hidden />
                {t("addExpense")}
              </QuickAddButton>
            }
            hint={t("orSay")}
          />
        </Card>
      </>
    );
  }

  const listHref = `/finance/transactions?month=${month}`;

  return (
    <>
      {header}
      <FinanceTabs />
      <MonthSwitcher month={month} hrefFor={(m) => `/finance?month=${m}`} className="mb-4" />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3" aria-label={t("summaryLabel")}>
        <StatCard
          index={0}
          label={t("income")}
          icon={<TrendingUp />}
          href={`${listHref}&type=income`}
        >
          <Amount minor={overview.incomeMinor} currency={currency} animated compact />
        </StatCard>
        <StatCard
          index={1}
          label={t("expense")}
          icon={<TrendingDown />}
          href={`${listHref}&type=expense`}
          footer={<Trend overview={overview} t={t} />}
        >
          <Amount minor={overview.expenseMinor} currency={currency} animated compact />
        </StatCard>
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            index={2}
            label={t("net")}
            icon={<Scale />}
            footer={
              overview.dailyAverageMinor > 0 && (
                <p className="text-caption text-muted">
                  {t("dailyAverage", {
                    amount: formatMoney(overview.dailyAverageMinor, { currency, compact: true }),
                  })}
                </p>
              )
            }
          >
            <Amount
              minor={overview.netMinor}
              currency={currency}
              kind={
                overview.netMinor < 0 ? "expense" : overview.netMinor > 0 ? "income" : "neutral"
              }
              animated
              compact
            />
          </StatCard>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>{t("byCategory")}</CardTitle>
          </CardHeader>
          {overview.expenseByCategory.length === 0 ? (
            <p className="py-6 text-center text-body text-muted">{t("noExpenseThisMonth")}</p>
          ) : (
            <CategoryBreakdown
              shares={overview.expenseByCategory}
              currency={currency}
              hrefBase={`${listHref}&type=expense`}
            />
          )}
          {overview.incomeByCategory.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-small text-muted">{t("incomeSources")}</h3>
              <CategoryBreakdown
                shares={overview.incomeByCategory}
                currency={currency}
                hrefBase={`${listHref}&type=income`}
              />
            </>
          )}
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>{t("monthTransactions")}</CardTitle>
            {recent.items.length > 0 && (
              <Link
                href={listHref}
                className="inline-flex items-center gap-1 text-small text-accent hover:underline"
              >
                {t("seeAll")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </CardHeader>
          {recent.items.length === 0 ? (
            <p className="py-6 text-center text-body text-muted">{t("noTransactionsThisMonth")}</p>
          ) : (
            <DayGroups items={recent.items} currency={currency} today={today} />
          )}
        </Card>
      </div>
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"finance">>>;

/** İçinde bulunulan ayda geçen ayın aynı gününe, geçmiş aylarda önceki ayın tamamına göre. */
function Trend({ overview, t }: { overview: MonthOverview; t: T }) {
  const previous = overview.previousExpenseMinor;
  if (previous === 0 || overview.expenseMinor === 0) return null;
  const change = Math.round(((overview.expenseMinor - previous) / previous) * 100);
  const label = t(overview.isCurrent ? "vsSamePeriod" : "vsPreviousMonth");
  if (change === 0) return <p className="text-caption text-muted">{t("trendSame")}</p>;
  const down = change < 0;
  return (
    <Badge tone={down ? "positive" : "negative"} title={label}>
      {down ? <TrendingDown aria-hidden /> : <TrendingUp aria-hidden />}
      <span className="sr-only">{label}: </span>
      {t(down ? "trendDown" : "trendUp", { percent: Math.abs(change) })}
    </Badge>
  );
}
