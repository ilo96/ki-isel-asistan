import { Target } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Amount } from "@/components/ui/amount";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { DashboardData } from "@/server/services/dashboard";

type Props = { goal: NonNullable<DashboardData["goal"]>; daysLeft: number; currency: CurrencyCode };

/** Birikim hedefi kartı: yalnızca aktif bir hedef varsa görünür. */
export async function GoalCard({ goal, daysLeft, currency }: Props) {
  const t = await getTranslations("home");
  const ratio = goal.targetMinor > 0 ? goal.savedMinor / goal.targetMinor : 0;
  const left = goal.targetMinor - goal.savedMinor;
  return (
    <Card>
      <div className="flex items-center gap-2 text-small text-muted">
        <Target className="size-4" aria-hidden />
        <h2>{t("goalTitle")}</h2>
      </div>
      <p className="mt-3 text-h2 text-text">
        <Amount minor={goal.savedMinor} currency={currency} compact />
        <span className="text-body text-muted">
          {" "}
          / {formatMoney(goal.targetMinor, { currency, compact: true })}
        </span>
      </p>
      <Progress kind="goal" value={ratio} label={t("goalTitle")} className="mt-3" />
      <div className="mt-2 flex justify-between gap-3 text-caption text-muted">
        <span className={left <= 0 ? "text-positive" : undefined}>
          {left <= 0
            ? t("goalReached")
            : t("goalLeft", { amount: formatMoney(left, { currency, compact: true }) })}
        </span>
        <span>{t("goalPeriod", { days: daysLeft })}</span>
      </div>
    </Card>
  );
}
