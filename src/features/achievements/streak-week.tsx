import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DateString } from "@/lib/dates";

const DAY = new Intl.DateTimeFormat("tr-TR", { weekday: "narrow", timeZone: "UTC" });

/** Son 7 günün noktaları: dolu = o gün kayıt girildi. Bugün halkayla işaretli. */
export function StreakWeek({
  week,
  label,
}: {
  week: { day: DateString; active: boolean }[];
  label: string;
}) {
  return (
    <ol className="flex justify-between gap-1.5" aria-label={label}>
      {week.map(({ day, active }, i) => (
        <li key={day} className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              "grid size-8 place-items-center rounded-full text-caption",
              active ? "bg-warning text-white" : "bg-surface-muted text-muted",
              i === week.length - 1 && "ring-2 ring-warning/40 ring-offset-2 ring-offset-surface",
            )}
          >
            {active ? <Check className="size-4" aria-hidden /> : null}
            <span className="sr-only">{active ? "✓" : "–"}</span>
          </span>
          <span className="text-caption text-muted">
            {DAY.format(new Date(`${day}T12:00:00Z`))}
          </span>
        </li>
      ))}
    </ol>
  );
}
