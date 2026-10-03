import { getTranslations } from "next-intl/server";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import type { Insight } from "@/server/services/dashboard";
import { DemoDataButton } from "./demo-data-button";
import { FirstSteps } from "./first-steps";

type Props = { insights: Insight[]; isEmpty: boolean; currency: CurrencyCode; showDemo: boolean };

/** Asistanın iki cümlelik özeti. Boşken karşılama ve üç öneri gösterir (plan: İlk açılış). */
export async function AssistantSummary({ insights, isEmpty, currency, showDemo }: Props) {
  const t = await getTranslations("home");
  const money = (minor: number | null) =>
    minor === null ? "none" : formatMoney(minor, { currency, compact: true });

  const sentence = (i: Insight): string => {
    switch (i.key) {
      case "billOverdue":
        return t("insight.billOverdue", { title: i.title, amount: money(i.amountMinor) });
      case "billSoon":
        return t("insight.billSoon", {
          title: i.title,
          days: i.days,
          amount: money(i.amountMinor),
        });
      case "budgetOver":
        return t("insight.budgetOver", { amount: money(i.overMinor) });
      case "budgetHigh":
        return t("insight.budgetHigh", { percent: i.percent, daysLeft: i.daysLeft });
      case "expenseDown":
      case "expenseUp":
        return t(`insight.${i.key}`, { percent: i.percent });
      case "goalReached":
        return t("insight.goalReached", { amount: money(i.targetMinor) });
      case "goalLeft":
        return t("insight.goalLeft", { amount: money(i.leftMinor) });
      case "topCategory":
        return t("insight.topCategory", { name: i.name, amount: money(i.amountMinor) });
      case "monthStart":
        return t("insight.monthStart");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-card border border-border/60 bg-surface p-5 shadow-card dark:border-transparent">
      <div className="absolute inset-y-0 left-0 w-1 ai-gradient" aria-hidden />
      <div className="flex items-start gap-4">
        <AssistantOrb size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-caption text-muted">{t("summaryLabel")}</p>
          {isEmpty ? (
            <>
              <p className="mt-1 text-body text-text">{t("welcome")}</p>
              <FirstSteps />
              {showDemo && <DemoDataButton mode="seed" className="mt-4" />}
            </>
          ) : (
            <p className="mt-1 text-body text-pretty text-text" aria-live="polite">
              {insights.map(sentence).join(" ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
