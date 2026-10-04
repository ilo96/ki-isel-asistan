/*
 * Sabah özeti: günün tek bildirimi. Sayılar servislerde hesaplanır, burada yalnızca
 * cümleye dökülür (saf fonksiyon, test edilebilir). En fazla üç parça: önce bugünün
 * ödemeleri, sonra bütçe, sonra dün ya da seri.
 */

export type DigestInput = {
  firstName: string | null;
  bills: { count: number; totalMinor: number };
  subscriptions: { count: number; totalMinor: number; names: string[] };
  reminders: number;
  /** Kalan oranı en düşük (ama aşılmamış) bütçe; yoksa null. */
  tightestBudget: { name: string | null; leftMinor: number } | null;
  overBudgets: number;
  yesterdayExpenseMinor: number;
  streak: number;
  /** Kullanıcının hiç kaydı yoksa özet gönderilmez. */
  hasData: boolean;
};

export type Digest = { title: string; body: string };

/** "08:30" + 240 dk içinde mi (gece yarısını aşmaz; sabah özeti için yeterli). */
export function inDigestWindow(now: string, start: string, windowMinutes = 240) {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const diff = toMin(now) - toMin(start);
  return diff >= 0 && diff < windowMinutes;
}

export function buildDigest(input: DigestInput, money: (minor: number) => string): Digest | null {
  if (!input.hasData) return null;
  const parts: string[] = [];

  const payments = input.bills.count + input.subscriptions.count;
  if (payments > 0) {
    const total = input.bills.totalMinor + input.subscriptions.totalMinor;
    parts.push(`Bugün ${payments} ödemen var${total > 0 ? ` (${money(total)})` : ""}`);
  } else if (input.reminders > 0) {
    parts.push(`Bugün ${input.reminders} hatırlatıcın var`);
  }

  if (input.overBudgets > 0) {
    parts.push(
      input.overBudgets === 1 ? "Bir bütçen aşıldı" : `${input.overBudgets} bütçen aşıldı`,
    );
  } else if (input.tightestBudget) {
    const where = input.tightestBudget.name
      ? `${input.tightestBudget.name} bütçende`
      : "Aylık bütçende";
    parts.push(`${where} ${money(input.tightestBudget.leftMinor)} kaldı`);
  }

  if (input.streak >= 2) parts.push(`${input.streak} günlük serin sürüyor 🔥`);
  else if (input.yesterdayExpenseMinor > 0)
    parts.push(`Dün ${money(input.yesterdayExpenseMinor)} harcadın`);

  if (parts.length === 0) parts.push("Bugün ödemen yok. Harcamalarını girmeyi unutma");

  const hello = input.firstName ? `Günaydın ${input.firstName}` : "Günaydın";
  return { title: `${hello} ☀️`, body: `${parts.slice(0, 3).join(" · ")}.` };
}
