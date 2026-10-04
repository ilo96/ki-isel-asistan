import { addDays, daysBetween, type DateString } from "@/lib/dates";
import { formatMoney, type CurrencyCode } from "@/lib/money";

/*
 * Araç sonuçlarındaki metinler. Rakamlar servislerden gelir; burada yalnızca kullanıcının
 * para birimi ve diliyle yazıya dökülür. Hem kartlar hem modelin gördüğü veri bunu kullanır.
 */

export const money = (minor: number, currency: CurrencyCode) =>
  formatMoney(minor, { currency, compact: true });

const dayFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  weekday: "short",
  timeZone: "UTC",
});

/** "Bugün", "Yarın", "Dün" ya da "5 Ekim Pzt". */
export function dayLabel(day: DateString, today: DateString) {
  const diff = daysBetween(today, day);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff === -1) return "Dün";
  return dayFormat.format(new Date(`${day}T12:00:00Z`));
}

const monthFormat = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const monthLabel = (monthStart: DateString) =>
  monthFormat.format(new Date(`${monthStart}T12:00:00Z`));

export const REPEAT_LABEL = {
  daily: "Her gün",
  weekly: "Her hafta",
  monthly: "Her ay",
  yearly: "Her yıl",
} as const;

/** Haftanın günü (0 = pazar) kullanıcının takvim gününden. */
export const weekdayOf = (day: DateString) => new Date(`${day}T12:00:00Z`).getUTCDay();

export { addDays };
