/*
 * Takvim günleri "YYYY-MM-DD" metni olarak taşınır ve her zaman kullanıcının saat
 * dilimine göre hesaplanır: gece 00:30'daki harcama yanlış güne (ve aya) düşmez.
 */

export type DateString = string;

/** users.timezone varsayılanı ile aynı. */
export const DEFAULT_TIMEZONE = "Europe/Istanbul";

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function toDateString(year: number, month: number, day: number): DateString {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parse(value: DateString) {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return { year, month, day };
}

/** Verilen anın kullanıcının saat dilimindeki takvim günü. */
export function dayIn(date: Date, timeZone: string): DateString {
  const { year, month, day } = partsIn(date, timeZone);
  return toDateString(year, month, day);
}

/** Bir takvim gününe gün ekler (eksi de olabilir). */
export function addDays(value: DateString, days: number): DateString {
  const { year, month, day } = parse(value);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** b − a, takvim günü olarak. */
export function daysBetween(a: DateString, b: DateString): number {
  const x = parse(a);
  const y = parse(b);
  return Math.round(
    (Date.UTC(y.year, y.month - 1, y.day) - Date.UTC(x.year, x.month - 1, x.day)) / 86_400_000,
  );
}

/** Günün ayının ilk ve son günü: "2026-10-01" ve "2026-10-31". */
export function monthOf(value: DateString): { start: DateString; end: DateString } {
  const { year, month } = parse(value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: toDateString(year, month, 1), end: toDateString(year, month, lastDay) };
}

/**
 * Bir önceki ayda aynı güne kadar olan aralık. 31 Mart'ın karşılığı 28/29 Şubat'tır;
 * böylece ay ortasında "geçen aya göre" kıyası eşit sayıda gün üzerinden yapılır.
 */
export function previousMonthToDate(value: DateString): { start: DateString; end: DateString } {
  const { year, month, day } = parse(value);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevLast = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  return {
    start: toDateString(prevYear, prevMonth, 1),
    end: toDateString(prevYear, prevMonth, Math.min(day, prevLast)),
  };
}

/** Verilen anın ayı, kullanıcının saat diliminde. */
export function monthBounds(date: Date, timeZone: string): { start: DateString; end: DateString } {
  return monthOf(dayIn(date, timeZone));
}

/** "2026-10" biçimindeki ay anahtarı. Finans ekranında URL'de taşınır (?month=2026-10). */
export type MonthKey = string;

export function monthKeyOf(value: DateString): MonthKey {
  return value.slice(0, 7);
}

/** Geçerli bir ay anahtarıysa ayın sınırlarını, değilse null döner. */
export function parseMonthKey(key: string | null | undefined) {
  if (!key || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return null;
  const year = Number(key.slice(0, 4));
  if (year < 2000 || year > 2100) return null;
  return monthOf(`${key}-01`);
}

/** Ay anahtarını ileri/geri kaydırır: shiftMonth("2026-01", -1) → "2025-12". */
export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const { year, month } = parse(`${key}-01`);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return toDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, 1).slice(0, 7);
}
