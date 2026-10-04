"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipBox } from "@/features/finance/charts/chart-tooltip";
import { useTokenColors } from "@/features/finance/charts/use-token-colors";
import type { DateString } from "@/lib/dates";
import { formatDuration } from "@/lib/fitness/units";
import { duration } from "@/lib/motion";
import { shortDate, weekdayShort } from "../format";

type Props = { days: { date: DateString; minutes: number; count: number }[]; today: DateString };

const TOKENS = ["accent", "text-muted", "border", "surface-muted"] as const;

/** Haftanın günlerine göre aktif dakika. Bugün vurgulanır, gelecek günler soluk. */
export default function ActivityChart({ days, today }: Props) {
  const t = useTranslations("fitness.charts");
  const c = useTokenColors(TOKENS);
  const data = days.map((d) => ({ ...d, label: weekdayShort(d.date), future: d.date > today }));

  return (
    <div className="h-48 w-full" aria-hidden inert>
      {c && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
          >
            <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: c["text-muted"], fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fill: c["text-muted"], fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: c["surface-muted"] }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !p || p.future) return null;
                return (
                  <ChartTooltipBox
                    title={shortDate(p.date)}
                    rows={[
                      {
                        label: t("active"),
                        value: p.minutes ? `${formatDuration(p.minutes)} · ${p.count}` : "—",
                        swatch: c.accent,
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="minutes"
              radius={[6, 6, 2, 2]}
              maxBarSize={28}
              fill={c.accent}
              animationDuration={duration.chart * 1000}
              shape={(props: unknown) => {
                const p = props as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  payload: (typeof data)[number];
                };
                const h = Math.max(p.height, p.payload.future ? 0 : 3);
                return (
                  <rect
                    x={p.x}
                    y={p.y + p.height - h}
                    width={p.width}
                    height={h}
                    rx={5}
                    fill={p.payload.minutes ? c.accent : c.border}
                    opacity={p.payload.date === today || !p.payload.minutes ? 1 : 0.75}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
