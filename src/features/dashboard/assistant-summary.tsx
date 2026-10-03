import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { phraseSummary } from "@/server/ai/summary";
import type { Insight } from "@/server/services/dashboard";
import { DemoDataButton } from "./demo-data-button";
import { FirstSteps } from "./first-steps";

type Props = {
  userId: string;
  insights: Insight[];
  isEmpty: boolean;
  currency: CurrencyCode;
  showDemo: boolean;
};

/** Asistanın iki cümlelik özeti. Boşken karşılama ve üç öneri gösterir (plan: İlk açılış). */
export async function AssistantSummary({ userId, insights, isEmpty, currency, showDemo }: Props) {
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

  // Anahtar varsa hızlı model cümleleri akıcılaştırır; yoksa kural tabanlı metin kalır.
  const text = isEmpty ? "" : await phraseSummary(userId, insights.map(sentence).join(" "));

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
            <>
              <p className="mt-1 text-body text-pretty text-text" aria-live="polite">
                {text}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(t.raw("askChips") as string[]).map((q) => (
                  <li key={q}>
                    <Link
                      href={`/assistant?q=${encodeURIComponent(q)}`}
                      className="inline-flex h-8 items-center rounded-full border border-border bg-bg px-3 text-caption text-text transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      {q}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
