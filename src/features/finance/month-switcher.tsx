import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { shiftMonth, type MonthKey } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Props = {
  month: MonthKey;
  /** Ay dışındaki filtreler korunur. */
  hrefFor: (month: MonthKey) => string;
  className?: string;
};

export function monthLabel(month: MonthKey) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
}

const arrow =
  "grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-text [&_svg]:size-5";

/** Önceki / sonraki ay; ay URL'de taşınır, böylece paylaşılabilir ve geri tuşuyla döner. */
export async function MonthSwitcher({ month, hrefFor, className }: Props) {
  const t = await getTranslations("finance");
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Link href={hrefFor(shiftMonth(month, -1))} className={arrow} aria-label={t("prevMonth")}>
        <ChevronLeft aria-hidden />
      </Link>
      <p
        className="min-w-32 text-center text-h2 text-text first-letter:uppercase"
        aria-live="polite"
      >
        {monthLabel(month)}
      </p>
      <Link href={hrefFor(shiftMonth(month, 1))} className={arrow} aria-label={t("nextMonth")}>
        <ChevronRight aria-hidden />
      </Link>
    </div>
  );
}
