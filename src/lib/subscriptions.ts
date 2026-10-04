import { addDays, daysBetween, daysInMonth, type DateString } from "@/lib/dates";

/*
 * Abonelik hesapları (saf fonksiyonlar). Kayıtta ilk ödeme günü saklanır; sonraki ödeme
 * günü her okumada bundan hesaplanır. Böylece 31'inde başlayan aylık abonelik Şubat'ta 28'e
 * düşer ama Mart'ta yine 31'e döner (kayma birikmez).
 */

export const SUBSCRIPTION_CYCLES = ["weekly", "monthly", "yearly"] as const;
export type SubscriptionCycle = (typeof SUBSCRIPTION_CYCLES)[number];

const pad = (n: number) => String(n).padStart(2, "0");

/** Ay ekler; hedef ayda o gün yoksa ayın son gününe kayar. */
export function addMonthsClamped(day: DateString, months: number): DateString {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

/** anchor'dan başlayarak k. ödeme günü. */
function occurrence(anchor: DateString, cycle: SubscriptionCycle, k: number): DateString {
  if (cycle === "weekly") return addDays(anchor, 7 * k);
  return addMonthsClamped(anchor, cycle === "monthly" ? k : 12 * k);
}

/** Bugün ya da sonraki ilk ödeme günü. */
export function nextChargeOn(
  anchor: DateString,
  cycle: SubscriptionCycle,
  today: DateString,
): DateString {
  if (anchor >= today) return anchor;
  const span = daysBetween(anchor, today);
  // Yaklaşık adım sayısından başla, sonra tam güne ilerle.
  let k = Math.max(0, Math.floor(span / (cycle === "weekly" ? 7 : cycle === "monthly" ? 31 : 366)));
  let next = occurrence(anchor, cycle, k);
  while (next < today) next = occurrence(anchor, cycle, ++k);
  return next;
}

/** Aylık eşdeğer maliyet (kuruş): haftalık × 52 / 12, yıllık / 12. */
export function monthlyCost(amountMinor: number, cycle: SubscriptionCycle): number {
  if (cycle === "weekly") return Math.round((amountMinor * 52) / 12);
  if (cycle === "yearly") return Math.round(amountMinor / 12);
  return amountMinor;
}

/* --------------------------------------------------------------- Tespit */

/** Abonelik olduğu neredeyse kesin hizmetler (norm edilmiş yazımla aranır). */
export const KNOWN_SERVICES = [
  "netflix",
  "spotify",
  "youtube",
  "disney",
  "amazon prime",
  "prime video",
  "icloud",
  "apple music",
  "apple one",
  "google one",
  "exxen",
  "blutv",
  "gain",
  "tod",
  "mubi",
  "tabii",
  "chatgpt",
  "claude",
  "xbox",
  "playstation",
  "game pass",
  "spor salonu",
  "macfit",
  "storytel",
  "duolingo",
] as const;

/** Küçük harf, Türkçe karakterler sadeleşmiş (keywords.norm ile aynı kural). */
export function normName(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ExpenseSample = {
  description: string;
  amountMinor: number;
  occurredOn: DateString;
  categoryId: string;
  /** Açıklama yalnızca kategori adıysa ("Market") tekrar etmesi abonelik anlamına gelmez. */
  generic?: boolean;
  categoryKey?: string | null;
};

/** Bu kategorilerdeki düzenli harcamalar (her ayın 13'ünde akşam yemeği, kira) abonelik sayılmaz. */
const NON_SUBSCRIPTION_KEYS = new Set(["food", "groceries", "transport", "rent", "health"]);

export type SubscriptionSuggestion = {
  name: string;
  amountMinor: number;
  cycle: SubscriptionCycle;
  /** Son ödemeden bir dönem sonrası; formda ilk ödeme günü olarak önerilir. */
  nextChargeOn: DateString;
  categoryId: string;
  /** Kaç ayrı ayda görüldü. */
  months: number;
};

const knownIn = (n: string) => KNOWN_SERVICES.find((s) => new RegExp(`(^|\\s)${s}(\\s|$)`).test(n));

/**
 * Gider geçmişinden abonelik adayları: aynı açıklama en az iki ayrı ayda benzer tutarla
 * (±%15) ve ayın yakın günlerinde (±5) geçiyorsa ya da açıklama bilinen bir hizmetse.
 * Yemek, market, ulaşım, kira ve faturalar düzenli olsa da abonelik olarak önerilmez.
 * Zaten takip edilen adlar (tracked, norm edilmiş) önerilmez.
 */
export function detectSubscriptions(
  expenses: ExpenseSample[],
  tracked: readonly string[],
  today: DateString,
): SubscriptionSuggestion[] {
  const skip = new Set(tracked.map(normName));
  const groups = new Map<string, ExpenseSample[]>();
  for (const e of expenses) {
    const key = normName(e.description);
    if (!key || skip.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const out: SubscriptionSuggestion[] = [];
  for (const [key, items] of groups) {
    const sorted = [...items].sort((a, b) => (a.occurredOn < b.occurredOn ? -1 : 1));
    const last = sorted.at(-1)!;
    const months = new Set(sorted.map((e) => e.occurredOn.slice(0, 7))).size;
    const known = knownIn(key);
    if ([...skip].some((t) => known && t.includes(known))) continue;

    if (
      !known &&
      (last.generic || NON_SUBSCRIPTION_KEYS.has(last.categoryKey ?? "") || /\bfatura/.test(key))
    )
      continue;

    const similar = sorted.filter(
      (e) => Math.abs(e.amountMinor - last.amountMinor) <= last.amountMinor * 0.15,
    );
    const days = similar.map((e) => Number(e.occurredOn.slice(8, 10)));
    const steadyDay = Math.max(...days) - Math.min(...days) <= 5;
    const similarMonths = new Set(similar.map((e) => e.occurredOn.slice(0, 7))).size;
    // Ayda bir kez: aynı ay içinde tekrar eden (ör. her gün kahve) abonelik sayılmaz.
    const recurring = similarMonths >= 2 && similar.length <= similarMonths + 1 && steadyDay;
    if (!recurring && !known) continue;

    let next = addMonthsClamped(last.occurredOn, 1);
    while (next < today) next = addMonthsClamped(next, 1);
    out.push({
      name: last.description.trim(),
      amountMinor: last.amountMinor,
      cycle: "monthly",
      nextChargeOn: next,
      categoryId: last.categoryId,
      months,
    });
  }
  return out.sort((a, b) => b.months - a.months || b.amountMinor - a.amountMinor);
}
