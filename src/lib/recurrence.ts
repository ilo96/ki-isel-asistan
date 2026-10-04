import { daysInMonth, dayIn, timeIn, zonedDateTime, type DateString } from "./dates";

/*
 * Tekrar kuralları RFC 5545 RRULE'un küçük bir alt kümesiyle saklanır:
 * FREQ (DAILY | WEEKLY | MONTHLY | YEARLY), INTERVAL ve aylıklar için BYMONTHDAY.
 * Böylece ileride tam bir RRULE kütüphanesine geçmek veri değişikliği gerektirmez.
 */

export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type Recurrence = {
  freq: Frequency;
  interval: number;
  /** Aylık tekrarda ayın günü (1–31); kısa aylarda son güne kayar. */
  byMonthDay?: number;
};

export function formatRule(rule: Recurrence): string {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`, `INTERVAL=${rule.interval}`];
  if (rule.freq === "monthly" && rule.byMonthDay) parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
  return parts.join(";");
}

/** Geçersiz ya da desteklenmeyen kural null döner (hatırlatıcı tek seferlik sayılır). */
export function parseRule(value: string | null | undefined): Recurrence | null {
  if (!value) return null;
  const map = new Map(
    value.split(";").map((p) => {
      const [k = "", v = ""] = p.split("=");
      return [k.trim().toUpperCase(), v.trim()] as const;
    }),
  );
  const freq = map.get("FREQ")?.toLowerCase() as Frequency | undefined;
  if (!freq || !FREQUENCIES.includes(freq)) return null;
  const interval = Number(map.get("INTERVAL") ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > 99) return null;
  const byMonthDay = map.has("BYMONTHDAY") ? Number(map.get("BYMONTHDAY")) : undefined;
  if (
    byMonthDay !== undefined &&
    !(Number.isInteger(byMonthDay) && byMonthDay >= 1 && byMonthDay <= 31)
  ) {
    return null;
  }
  return { freq, interval, ...(byMonthDay ? { byMonthDay } : {}) };
}

/** Basit seçici için: "none" ya da sıklık; aylıkta gün ilk tarihten alınır. */
export function ruleFor(freq: Frequency, firstDay: DateString): Recurrence {
  return freq === "monthly"
    ? { freq, interval: 1, byMonthDay: Number(firstDay.slice(8, 10)) }
    : { freq, interval: 1 };
}

function nextDay(day: DateString, rule: Recurrence): DateString {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (rule.freq === "daily" || rule.freq === "weekly") {
    const step = rule.interval * (rule.freq === "weekly" ? 7 : 1);
    const next = new Date(Date.UTC(y, m - 1, d + step));
    return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  }
  if (rule.freq === "monthly") {
    const total = y * 12 + (m - 1) + rule.interval;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const want = rule.byMonthDay ?? d;
    return `${ny}-${pad(nm)}-${pad(Math.min(want, daysInMonth(ny, nm)))}`;
  }
  // Yıllık: 29 Şubat artık olmayan yıllarda 28 Şubat'a düşer.
  const ny = y + rule.interval;
  return `${ny}-${pad(m)}-${pad(Math.min(d, daysInMonth(ny, m)))}`;
}

/**
 * Bir sonraki tekrar: saat kullanıcının saat diliminde korunur (09:00 hatırlatıcı yaz saati
 * değişse de 09:00'da kalır). `after` verilirse ondan sonraki ilk tekrara kadar ilerler.
 */
export function nextOccurrence(
  current: Date,
  rule: Recurrence,
  timeZone: string,
  after?: Date,
): Date {
  const time = timeIn(current, timeZone);
  let day = dayIn(current, timeZone);
  let next = zonedDateTime(nextDay(day, rule), time, timeZone);
  // Uzun süre açılmamış bir hatırlatıcı geçmişte kalmasın; en fazla birkaç yüz adım.
  for (let i = 0; after && next <= after && i < 1000; i++) {
    day = dayIn(next, timeZone);
    next = zonedDateTime(nextDay(day, rule), time, timeZone);
  }
  return next;
}
