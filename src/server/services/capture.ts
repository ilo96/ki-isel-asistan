import { addDays, type DateString } from "@/lib/dates";
import type { CategoryOption, TransactionType } from "@/lib/finance/types";
import type { TransactionDraft } from "@/lib/finance/draft";
import { MAX_AMOUNT_MINOR } from "@/lib/validation/finance";
import { categoryKeyFor, norm } from "@/server/ai/keywords";
import { findAmount, findDate, parseIntent } from "@/server/ai/offline/parse";
import type { ReceiptResult } from "@/server/ai/receipt";

/*
 * Sesle ekleme ve fiş okuma, ikisi de bir taslak üretir; taslak hızlı ekle formunu doldurur
 * ve kullanıcı Kaydet'e basmadan hiçbir şey yazılmaz. Söylenen cümle asistanın çevrimdışı
 * ayrıştırıcısıyla çözülür (API anahtarı gerekmez).
 */

/** Kategori ipucunu (sistem anahtarı ya da ad) kullanıcının kategorisine eşler; yoksa "Diğer". */
export function matchCategory(
  all: CategoryOption[],
  type: TransactionType,
  hint: string | null,
  text = "",
): string | null {
  const cats = all.filter((c) => c.type === type && !c.archived);
  const byKey = (key: string | null) => (key ? cats.find((c) => c.systemKey === key) : undefined);
  const n = norm(text);
  const found =
    (hint ? cats.find((c) => norm(c.name) === norm(hint)) : undefined) ??
    // Kullanıcının kendi kategori adı cümlede geçiyorsa önce o ("Kahve 90 TL" → "Kahve", "Yemek" değil).
    (n ? cats.find((c) => ` ${n}`.includes(` ${norm(c.name)}`)) : undefined) ??
    byKey(hint) ??
    byKey(categoryKeyFor(text, type)) ??
    byKey(type === "income" ? "other_income" : "other_expense");
  return found?.id ?? null;
}

const toMinor = (value: number) => {
  const minor = Math.round(value * 100);
  return minor > 0 && minor <= MAX_AMOUNT_MINOR ? minor : null;
};

export function draftFromSpeech(
  text: string,
  categories: CategoryOption[],
  today: DateString,
): TransactionDraft | null {
  const spoken = text.trim();
  if (!spoken) return null;
  const intent = parseIntent(spoken, today);
  if (intent.kind === "transaction") {
    return {
      source: "voice",
      type: intent.type,
      amountMinor: toMinor(intent.amount),
      categoryId: matchCategory(categories, intent.type, intent.category, spoken),
      description: intent.description,
      occurredOn: intent.date,
      heard: spoken,
    };
  }
  // Tutarsız cümle ("markete gittim") da forma gelsin; tutarı kullanıcı yazar.
  const amount = findAmount(spoken);
  const date = findDate(norm(spoken), today);
  return {
    source: "voice",
    type: "expense",
    amountMinor: amount ? toMinor(amount.value) : null,
    categoryId: matchCategory(categories, "expense", null, spoken),
    description: "",
    occurredOn: date && date.date <= today ? date.date : today,
    heard: spoken,
  };
}

/** Fiş tarihi gelecekteyse ya da bir yıldan eskiyse (yanlış okuma) bugün kullanılır. */
export function draftFromReceipt(
  r: ReceiptResult,
  categories: CategoryOption[],
  today: DateString,
): TransactionDraft {
  const date = r.date && r.date <= today && r.date >= addDays(today, -365) ? r.date : today;
  return {
    source: "receipt",
    type: "expense",
    amountMinor: r.total !== null ? toMinor(r.total) : null,
    categoryId: matchCategory(categories, "expense", r.category, r.merchant ?? ""),
    description: r.merchant?.slice(0, 120) ?? "",
    occurredOn: date,
    heard: null,
  };
}
