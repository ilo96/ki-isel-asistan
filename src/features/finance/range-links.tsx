import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/cn";
import { RANGES, type RangeKey } from "@/lib/finance/range";

type Props = { value: RangeKey; hrefFor: (range: RangeKey) => string };

/** Grafik aralığı (3 / 6 / 12 ay); URL'de taşınır, geri tuşuyla döner. */
export async function RangeLinks({ value, hrefFor }: Props) {
  const t = await getTranslations("finance.charts");
  return (
    <nav aria-label={t("rangeLabel")}>
      <ul className="inline-flex rounded-button bg-surface-muted p-1">
        {RANGES.map((range) => {
          const active = range === value;
          return (
            <li key={range}>
              <Link
                href={hrefFor(range)}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-[11px] px-3 text-caption transition-colors duration-[180ms]",
                  active
                    ? "bg-surface text-text shadow-card dark:bg-surface-raised"
                    : "text-muted hover:text-text",
                )}
              >
                {t(`range.${range}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
