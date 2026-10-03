import { addDays, daysBetween, type DateString } from "@/lib/dates";
import type { LifeItem } from "@/lib/life/types";

type T = (key: string, values?: Record<string, string | number>) => string;

/** "Bugün", "Yarın", "3 gün sonra", "12 Ekim Pazartesi". */
export function relativeDay(t: T, day: DateString, today: DateString, { long = false } = {}) {
  const diff = daysBetween(today, day);
  if (diff === 0) return t("day.today");
  if (diff === 1) return t("day.tomorrow");
  if (diff === -1) return t("day.yesterday");
  if (!long && diff > 1 && diff < 7) return t("day.inDays", { count: diff });
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    ...(long ? { weekday: "long" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Satırın alt bilgisi: tarih, saat, tekrar. showDate false ise tarih yazılmaz (Yaklaşan'da
 * grup başlığı zaten söylüyor); bugünün tarihi hiçbir zaman tekrar yazılmaz.
 */
export function lifeMeta(t: T, item: LifeItem, today: DateString, { showDate = true } = {}) {
  const parts: string[] = [];
  if (item.date && showDate && item.date !== today) parts.push(relativeDay(t, item.date, today));
  if (item.type === "reminder" && item.time) parts.push(item.time);
  if (item.type === "reminder" && item.repeat) parts.push(t(`repeat.${item.repeat}`));
  return parts.join(" · ");
}

export function isToday(item: LifeItem, today: DateString) {
  return item.date === today;
}

export function tomorrowOf(today: DateString) {
  return addDays(today, 1);
}
