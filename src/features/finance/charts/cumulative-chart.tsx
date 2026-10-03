"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurrencyCode } from "@/lib/money";
import { duration } from "@/lib/motion";
import type { CumulativePoint } from "@/server/services/finance-trends";
import { ChartTooltipBox } from "./chart-tooltip";
import { axisMoney, fullMoney } from "./format";
import { useTokenColors } from "./use-token-colors";

type Props = { points: CumulativePoint[]; currency: CurrencyCode };

const TOKENS = ["accent", "text-muted", "border"] as const;

/** Bu ayın birikimli gideri (dolu alan) ve geçen ayın aynı günleri (kesikli çizgi). */
export default function CumulativeChart({ points, currency }: Props) {
  const t = useTranslations("finance.charts");
  const c = useTokenColors(TOKENS);
  const last = [...points].reverse().find((p) => p.current !== null);

  return (
    <>
      <div className="h-48 w-full" aria-hidden>
        {c && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="cum-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
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
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as CumulativePoint | undefined;
                  if (!active || !p) return null;
                  const rows = [];
                  if (p.current !== null) {
                    rows.push({
                      label: t("thisMonth"),
                      value: fullMoney(p.current, currency),
                      swatch: c.accent,
                    });
                  }
                  if (p.previous !== null) {
                    rows.push({
                      label: t("lastMonth"),
                      value: fullMoney(p.previous, currency),
                      swatch: c["text-muted"],
                    });
                  }
                  return <ChartTooltipBox title={t("dayN", { day: p.day })} rows={rows} />;
                }}
              />
              <Area
                type="monotone"
                dataKey="previous"
                stroke={c["text-muted"]}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                fill="none"
                dot={false}
                connectNulls={false}
                animationDuration={duration.chart * 1000}
              />
              <Area
                type="monotone"
                dataKey="current"
                stroke={c.accent}
                strokeWidth={2}
                fill="url(#cum-fill)"
                dot={false}
                connectNulls={false}
                animationDuration={duration.chart * 1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 flex gap-4 text-caption text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-accent" />
          {t("thisMonth")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-muted" />
          {t("lastMonth")}
        </span>
      </div>
      {last && (
        <p className="sr-only">
          {t("cumulativeSummary", {
            day: last.day,
            current: fullMoney(last.current ?? 0, currency),
            previous: fullMoney(last.previous ?? 0, currency),
          })}
        </p>
      )}
    </>
  );
}
