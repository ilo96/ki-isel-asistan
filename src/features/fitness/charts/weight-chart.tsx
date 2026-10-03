"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipBox } from "@/features/finance/charts/chart-tooltip";
import { useTokenColors } from "@/features/finance/charts/use-token-colors";
import type { DateString } from "@/lib/dates";
import { formatWeight, gramsToKg } from "@/lib/fitness/units";
import { duration } from "@/lib/motion";
import { shortDate } from "../format";

type Props = { points: { date: DateString; weightG: number }[]; targetG: number | null };

const TOKENS = ["accent", "text-muted", "border", "positive"] as const;
const kg = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

/** Tarih (x) ve kilo (y). Hedef varsa kesikli çizgi. */
export default function WeightChart({ points, targetG }: Props) {
  const t = useTranslations("fitness.charts");
  const c = useTokenColors(TOKENS);
  const data = points.map((p) => ({ date: p.date, kg: gramsToKg(p.weightG) }));
  const values = [...data.map((d) => d.kg), ...(targetG ? [gramsToKg(targetG)] : [])];
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);

  return (
    <>
      <div className="h-56 w-full" aria-hidden inert>
        {c && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              accessibilityLayer={false}
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.accent} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => shortDate(d)}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
                tick={{ fill: c["text-muted"], fontSize: 12 }}
              />
              <YAxis
                domain={[min, max]}
                tickFormatter={(v: number) => kg.format(v)}
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fill: c["text-muted"], fontSize: 12 }}
              />
              {targetG && (
                <ReferenceLine
                  y={gramsToKg(targetG)}
                  stroke={c.positive}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                />
              )}
              <Tooltip
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as { date: string; kg: number } | undefined;
                  if (!active || !p) return null;
                  return (
                    <ChartTooltipBox
                      title={shortDate(p.date)}
                      rows={[
                        { label: t("weight"), value: formatWeight(p.kg * 1000), swatch: c.accent },
                      ]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="kg"
                stroke={c.accent}
                strokeWidth={2}
                fill="url(#weight-fill)"
                dot={data.length <= 20 ? { r: 3, fill: c.accent, strokeWidth: 0 } : false}
                activeDot={{ r: 5 }}
                animationDuration={duration.chart * 1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {targetG && (
        <div className="mt-3 flex gap-4 text-caption text-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-accent" />
            {t("weight")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dashed border-positive" />
            {t("target")}
          </span>
        </div>
      )}
    </>
  );
}
