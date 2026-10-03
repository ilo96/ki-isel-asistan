import "server-only";
import { dayIn, DEFAULT_TIMEZONE, monthKeyOf, parseMonthKey } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";

/** Finans sayfalarının ortak başlangıcı: kullanıcı, bugünün tarihi ve URL'deki ay. */
export async function financePageContext(monthParam?: string | string[]) {
  const user = await requireUser();
  const timeZone = user.timezone ?? DEFAULT_TIMEZONE;
  const today = dayIn(new Date(), timeZone);
  const requested = typeof monthParam === "string" ? monthParam : undefined;
  const range = parseMonthKey(requested) ?? parseMonthKey(monthKeyOf(today))!;
  return {
    db: await getDb(),
    userId: user.id,
    currency: (user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
    today,
    month: monthKeyOf(range.start),
    range,
  };
}
