import { PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { DashboardData } from "@/server/services/dashboard";
import { StatCard } from "./stat-card";

type Props = { data: DashboardData; currency: CurrencyCode };

/** Dört özet kartı: bakiye, bu ayki gelir, bu ayki gider ve kalan bütçe. */
export async function SummaryCards({ data, currency }: Props) {
  const t = await getTranslations("home");
  const budget = data.budget;
  const budgetLeft = budget ? budget.limitMinor - budget.spentMinor : 0;
  const ratio = budget && budget.limitMinor > 0 ? budget.spentMinor / budget.limitMinor : 0;

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label={t("summaryLabel")}>
      <StatCard
        index={0}
        label={t("balance")}
        icon={<Wallet />}
        footer={<p className="text-caption text-muted">{t("balanceFooter")}</p>}
      >
        <Amount minor={data.balanceMinor} currency={currency} animated compact />
      </StatCard>
      <StatCard index={1} label={t("income")} icon={<TrendingUp />} href="/finance">
        <Amount minor={data.incomeMinor} currency={currency} animated compact />
      </StatCard>
      <StatCard
        index={2}
        label={t("expense")}
        icon={<TrendingDown />}
        href="/finance"
        footer={<ExpenseTrend data={data} t={t} />}
      >
        <Amount minor={data.expenseMinor} currency={currency} animated compact />
      </StatCard>
      <StatCard
        index={3}
        label={t("budgetLeft")}
        icon={<PiggyBank />}
        href="/finance/budgets"
        footer={
          budget ? (
            <div className="space-y-1.5">
              <Progress value={ratio} label={t("budgetLeft")} />
              <p className="text-caption text-muted">
                {budgetLeft < 0
                  ? t("budgetOver", {
                      amount: formatMoney(-budgetLeft, { currency, compact: true }),
                    })
                  : t("budgetOf", {
                      limit: formatMoney(budget.limitMinor, { currency, compact: true }),
                      percent: Math.floor(ratio * 100),
                    })}
              </p>
            </div>
          ) : (
            <p className="text-caption text-muted">{t("noBudget")}</p>
          )
        }
      >
        <Amount minor={Math.max(budgetLeft, 0)} currency={currency} animated compact />
      </StatCard>
    </section>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"home">>>;

/** Gider geçen ayın aynı dönemine göre azaldıysa yeşil, arttıysa kırmızı; ok ve metin de söyler. */
function ExpenseTrend({ data, t }: { data: DashboardData; t: T }) {
  const previous = data.previousExpenseToDateMinor;
  if (previous === 0 || data.expenseMinor === 0) return null;
  const change = Math.round(((data.expenseMinor - previous) / previous) * 100);
  if (change === 0) return <p className="text-caption text-muted">{t("trendSame")}</p>;
  const down = change < 0;
  return (
    <Badge tone={down ? "positive" : "negative"} title={t("vsLastMonth")}>
      {down ? <TrendingDown aria-hidden /> : <TrendingUp aria-hidden />}
      <span className="sr-only">{t("vsLastMonth")}: </span>
      {t(down ? "trendDown" : "trendUp", { percent: Math.abs(change) })}
    </Badge>
  );
}
