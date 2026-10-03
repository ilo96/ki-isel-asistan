import { getTranslations } from "next-intl/server";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { daysBetween, type DateString } from "@/lib/dates";
import { groupByDay } from "@/lib/finance/group";
import type { TransactionItem } from "@/lib/finance/types";
import { TransactionRow } from "./transaction-row";

type Props = { items: TransactionItem[]; currency: CurrencyCode; today: DateString };

/** Günlere göre gruplu işlem listesi; her günün başlığında o günün net tutarı. */
export async function DayGroups({ items, currency, today }: Props) {
  const t = await getTranslations("home.day");
  const label = (day: DateString) => {
    const diff = daysBetween(day, today);
    if (diff === 0) return t("today");
    if (diff === 1) return t("yesterday");
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  };

  return (
    <div className="-mx-2 space-y-5">
      {groupByDay(items).map((group) => (
        <section key={group.day} aria-label={label(group.day)}>
          <div className="mb-1 flex items-baseline justify-between px-2 text-small text-muted">
            <h3 className="first-letter:uppercase">{label(group.day)}</h3>
            <span className="money">{formatMoney(group.netMinor, { currency, signed: true })}</span>
          </div>
          <ul>
            {group.items.map((item) => (
              <li key={item.id}>
                <TransactionRow item={item} currency={currency} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
