type T = (key: string, values?: Record<string, string | number>) => string;

/** "Bugün", "Yarın", "3 gün sonra" ya da "12 Eki"; tarih kullanıcının saat diliminde yazılır. */
export function dayLabel(
  t: T,
  days: number,
  date: Date,
  timeZone: string,
  { past = false }: { past?: boolean } = {},
) {
  if (days === 0) return t("day.today");
  if (days === 1 && !past) return t("day.tomorrow");
  if (days === 1 && past) return t("day.yesterday");
  if (!past && days > 1 && days < 7) return t("day.inDays", { count: days });
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone }).format(
    date,
  );
}

export function timeLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone }).format(
    date,
  );
}

/** "YYYY-MM-DD" takvim gününü saat diliminden bağımsız bir ana çevirir (öğlen UTC). */
export function noonOf(day: string) {
  return new Date(`${day}T12:00:00Z`);
}
