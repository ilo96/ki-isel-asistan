import type { DateString } from "@/lib/dates";
import type { TransactionItem } from "./types";

/** Gün bazında gruplar; liste zaten tarihe göre sıralı geldiği için sıra korunur. */
export function groupByDay(items: TransactionItem[]) {
  const groups: { day: DateString; items: TransactionItem[]; netMinor: number }[] = [];
  for (const item of items) {
    let group = groups.at(-1);
    if (!group || group.day !== item.occurredOn) {
      group = { day: item.occurredOn, items: [], netMinor: 0 };
      groups.push(group);
    }
    group.items.push(item);
    group.netMinor += item.type === "income" ? item.amountMinor : -item.amountMinor;
  }
  return groups;
}
