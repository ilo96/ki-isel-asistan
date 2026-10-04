import { addDays, type DateString } from "@/lib/dates";

const short = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" });

const at = (day: DateString) => new Date(`${day}T12:00:00Z`);

/** "Bugün", "Dün" ya da "12 Eki". */
export function relativeDay(
  day: DateString,
  today: DateString,
  words: { today: string; yesterday: string },
) {
  if (day === today) return words.today;
  if (day === addDays(today, -1)) return words.yesterday;
  return short.format(at(day));
}

export const shortDate = (day: DateString) => short.format(at(day));
export const weekdayShort = (day: DateString) => weekday.format(at(day));
