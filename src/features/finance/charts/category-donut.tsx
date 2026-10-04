"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CATEGORY_COLORS, type CategoryColor } from "@/lib/finance/categories";
import type { CurrencyCode } from "@/lib/money";
import { duration } from "@/lib/motion";
import type { CategoryShare } from "@/server/services/finance-overview";
import { fullMoney } from "./format";
import { useTokenColors } from "./use-token-colors";

type Props = { shares: CategoryShare[]; totalMinor: number; currency: CurrencyCode };

/** En büyük 5 kategori ve "Diğer"; ortada ayın toplam gideri. */
const TOP = 5;

export default function CategoryDonut({ shares, totalMinor, currency }: Props) {
  const t = useTranslations("finance.charts");
  const c = useTokenColors([...CATEGORY_COLORS, "surface"] as const);
  const top = shares.slice(0, TOP);
  const rest = shares.slice(TOP).reduce((sum, s) => sum + s.totalMinor, 0);
  const data = [
    ...top.map((s) => ({
      name: s.name,
      value: s.totalMinor,
      color: s.colorToken as CategoryColor,
    })),
    ...(rest > 0 ? [{ name: t("other"), value: rest, color: "cat-8" as CategoryColor }] : []),
  ];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-52" aria-hidden inert>
      {c && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke={c.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              animationDuration={duration.chart * 1000}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={c[d.color] ?? c["cat-8"]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-caption text-muted">{t("total")}</p>
          <p className="text-h2 money text-text">{fullMoney(totalMinor, currency)}</p>
        </div>
      </div>
    </div>
  );
}
