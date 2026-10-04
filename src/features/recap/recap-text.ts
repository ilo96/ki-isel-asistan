import type { MonthlyRecap } from "@/lib/recap";
import { formatMoney, type CurrencyCode } from "@/lib/money";

/*
 * Kartta ve paylaşılan görselde aynı metinler kullanılır. Tutarlar gizliyse (paylaşımın
 * varsayılanı) yalnızca oranlar ve sayılar görünür; harcama tutarı herkese açık olmaz.
 */

export type RecapStrings = {
  personaTitle: string;
  personaBody: string;
  headline: string;
  headlineSub: string | null;
  stats: { label: string; value: string }[];
  categories: { name: string; share: number; amount: string | null }[];
  biggest: string | null;
};

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function recapStrings(
  r: MonthlyRecap,
  { showAmounts, currency, t }: { showAmounts: boolean; currency: CurrencyCode; t: Translate },
): RecapStrings {
  const money = (m: number) => formatMoney(m, { currency, compact: true });
  const pct = (v: number) => `%${Math.round(Math.abs(v) * 100)}`;
  const change =
    r.expenseChange === null
      ? null
      : r.expenseChange === 0
        ? t("changeSame")
        : t(r.expenseChange < 0 ? "changeLess" : "changeMore", {
            percent: Math.abs(r.expenseChange),
          });

  const headline = showAmounts
    ? t("spent", { amount: money(r.expenseMinor) })
    : t("transactions", { count: r.transactionCount });

  const stats = [
    showAmounts ? { label: t("statTransactions"), value: String(r.transactionCount) } : null,
    { label: t("statNoSpend"), value: t("daysValue", { count: r.noSpendDays }) },
    { label: t("statStreak"), value: t("daysValue", { count: r.bestStreak }) },
    r.savingsRate !== null
      ? {
          label: r.savingsRate >= 0 ? t("statSaved") : t("statOver"),
          value: showAmounts ? money(Math.abs(r.netMinor)) : pct(r.savingsRate),
        }
      : null,
    !showAmounts && r.busiestWeekday !== null
      ? { label: t("statBusiest"), value: t(`weekdays.${r.busiestWeekday}`) }
      : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  return {
    personaTitle: t(`personas.${r.persona.key}.title`),
    personaBody: t(`personas.${r.persona.key}.body`),
    headline,
    headlineSub: change,
    stats: stats.slice(0, 4),
    categories: r.topCategories.map((c) => ({
      name: c.name,
      share: c.share,
      amount: showAmounts ? money(c.amountMinor) : null,
    })),
    biggest:
      showAmounts && r.biggest
        ? t("biggest", { what: r.biggest.description, amount: money(r.biggest.amountMinor) })
        : null,
  };
}
