"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/lib/money";
import { duration } from "@/lib/motion";
import type { MonthPoint } from "@/server/services/finance-trends";
import { ChartTooltipBox } from "./chart-tooltip";
import { axisMoney, fullMoney, monthName } from "./format";
import { useTokenColors } from "./use-token-colors";

type Props = { points: MonthPoint[]; currency: CurrencyCode };

const TOKENS = ["positive", "negative", "border", "text-muted"] as const;

/** Aylara göre gelir ve gider sütunları. Aynı veri ekran okuyucu için tablo olarak da var. */
export default function MonthlyChart({ points, currency }: Props) {
  const t = useTranslations("finance.charts");
  const c = useTokenColors(TOKENS);
  const data = points.map((p) => ({ ...p, label: monthName(p.month) }));

  return (
    <>
      <div className="h-56 w-full" aria-hidden inert>
        {c && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer={false} data={data} barGap={4} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: c["text-muted"], fontSize: 12 }}
              />
              <YAxis
                tickFormatter={axisMoney}
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: c["text-muted"], fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: c.border, opacity: 0.4 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (MonthPoint & { label: string }) | undefined;
                  if (!active || !p) return null;
                  return (
                    <ChartTooltipBox
                      title={monthName(p.month, "long")}
                      rows={[
                        {
                          label: t("income"),
                          value: fullMoney(p.incomeMinor, currency),
                          swatch: c.positive,
                        },
                        {
                          label: t("expense"),
                          value: fullMoney(p.expenseMinor, currency),
                          swatch: c.negative,
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar
                dataKey="incomeMinor"
                fill={c.positive}
                radius={[6, 6, 0, 0]}
                maxBarSize={22}
                animationDuration={duration.chart * 1000}
              />
              <Bar
                dataKey="expenseMinor"
                fill={c.negative}
                radius={[6, 6, 0, 0]}
                maxBarSize={22}
                animationDuration={duration.chart * 1000}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 flex gap-4 text-caption text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-positive" />
          {t("income")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-negative" />
          {t("expense")}
        </span>
      </div>
      <table className="sr-only">
        <caption>{t("monthlyCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("month")}</th>
            <th scope="col">{t("income")}</th>
            <th scope="col">{t("expense")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthName(p.month, "long")}</th>
              <td>{fullMoney(p.incomeMinor, currency)}</td>
              <td>{fullMoney(p.expenseMinor, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
