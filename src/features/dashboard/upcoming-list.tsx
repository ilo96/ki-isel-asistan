import { Bell, CalendarClock, CalendarHeart, Receipt, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { CurrencyCode } from "@/lib/money";
import type { UpcomingItem } from "@/server/services/dashboard";
import { dayLabel, timeLabel } from "./day-label";

const KIND_ICON: Record<UpcomingItem["kind"], LucideIcon> = {
  bill: Receipt,
  reminder: Bell,
  important_date: CalendarHeart,
};

type Props = { items: UpcomingItem[]; currency: CurrencyCode; timeZone: string };

/** Önümüzdeki 14 günün faturaları, hatırlatıcıları ve önemli günleri; geciken faturalar en üstte. */
export async function UpcomingList({ items, currency, timeZone }: Props) {
  const t = await getTranslations("home");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("upcoming")}</CardTitle>
        {items.length > 0 && (
          <Link href="/tasks" className="text-small text-accent hover:underline">
            {t("seeTasks")}
          </Link>
        )}
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={t("upcomingEmptyTitle")}
          description={t("upcomingEmptyBody")}
          action={<QuickAddButton variant="soft">{t("addReminder")}</QuickAddButton>}
          hint={t("orSay")}
        />
      ) : (
        <ul className="-mx-2">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const when = dayLabel(t, item.daysUntil, item.dueAt, timeZone);
            return (
              <li
                key={item.id}
                className="flex min-h-14 items-center gap-3 rounded-input px-2 py-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    item.overdue ? "bg-negative-soft text-negative" : "bg-accent-soft text-accent",
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-text">{item.title}</p>
                  <p className="text-small text-muted">
                    <span className="sr-only">{t(`kind.${item.kind}`)}, </span>
                    {item.overdue ? (
                      <Badge tone="negative">{t("day.overdue")}</Badge>
                    ) : (
                      <>
                        {when}
                        {!item.allDay && ` · ${timeLabel(item.dueAt, timeZone)}`}
                      </>
                    )}
                  </p>
                </div>
                {item.amountMinor !== null && (
                  <Amount
                    minor={item.amountMinor}
                    currency={currency}
                    compact
                    className="text-body"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
