"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Amount } from "@/components/ui/amount";
import { CategoryIcon } from "@/features/dashboard/category-icon";
import type { CategoryColor } from "@/lib/finance/categories";
import { duration, ease } from "@/lib/motion";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryShare } from "@/server/services/finance-overview";

// Tailwind sınıfları derleme anında görülmeli; bu yüzden tek tek yazılı.
const BARS: Record<CategoryColor, string> = {
  "cat-1": "bg-cat-1",
  "cat-2": "bg-cat-2",
  "cat-3": "bg-cat-3",
  "cat-4": "bg-cat-4",
  "cat-5": "bg-cat-5",
  "cat-6": "bg-cat-6",
  "cat-7": "bg-cat-7",
  "cat-8": "bg-cat-8",
};

type Props = {
  shares: CategoryShare[];
  currency: CurrencyCode;
  /** Sorgu dizesi içeren bağlantı; sonuna kategori eklenir. */
  hrefBase: string;
};

/** Kategori dağılımı: en büyükten küçüğe, payı çubukla ve yüzdeyle. Satır, o kategorinin işlemlerine götürür. */
export function CategoryBreakdown({ shares, currency, hrefBase }: Props) {
  const reduce = useReducedMotion();
  const max = Math.max(...shares.map((s) => s.percent), 1);
  return (
    <ul className="-mx-2 space-y-1">
      {shares.map((s, i) => (
        <li key={s.id}>
          <Link
            href={`${hrefBase}&categoryId=${s.id}`}
            className="flex items-center gap-3 rounded-input px-2 py-2 transition-colors hover:bg-surface-muted"
          >
            <CategoryIcon icon={s.icon} colorToken={s.colorToken} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-body text-text">{s.name}</p>
                <Amount minor={s.totalMinor} currency={currency} className="text-body" />
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <motion.div
                    className={`h-full rounded-full ${BARS[s.colorToken as CategoryColor] ?? BARS["cat-8"]}`}
                    initial={{ width: reduce ? `${(s.percent / max) * 100}%` : 0 }}
                    animate={{ width: `${(s.percent / max) * 100}%` }}
                    transition={{ duration: duration.chart, ease, delay: reduce ? 0 : i * 0.04 }}
                  />
                </div>
                <span className="w-12 text-right text-caption money text-muted">
                  %{s.percent.toLocaleString("tr-TR")}
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
