/*
 * Türkçe anahtar kelimeler: hem çevrimdışı motor hem de modelin verdiği kategori adını
 * kullanıcının kategorisine eşlerken kullanılır. Karşılaştırma norm() ile yapılır.
 */

/** Küçük harf, Türkçe karakterler sadeleşmiş: "Doğalgaz" → "dogalgaz". */
export function norm(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Varsayılan kategori anahtarı → onu çağrıştıran kelimeler (norm edilmiş). */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    "yemek",
    "restoran",
    "lokanta",
    "kahve",
    "kafe",
    "ogle",
    "aksam yemegi",
    "kahvalti",
    "pizza",
    "burger",
    "doner",
    "kebap",
    "yemeksepeti",
    "tatli",
  ],
  groceries: ["market", "migros", "bim", "a101", "sok", "carrefour", "manav", "bakkal", "kasap"],
  transport: [
    "taksi",
    "otobus",
    "metro",
    "benzin",
    "akaryakit",
    "mazot",
    "ulasim",
    "uber",
    "otopark",
    "istanbulkart",
    "kopru",
    "otoyol",
  ],
  rent: ["kira"],
  bills: [
    "fatura",
    "elektrik",
    "dogalgaz",
    "su faturasi",
    "internet",
    "telefon",
    "aidat",
    "abonelik",
  ],
  health: ["ilac", "eczane", "doktor", "hastane", "saglik", "dis", "muayene"],
  entertainment: ["sinema", "konser", "netflix", "spotify", "oyun", "eglence", "tiyatro", "bilet"],
  shopping: [
    "giyim",
    "kiyafet",
    "ayakkabi",
    "alisveris",
    "trendyol",
    "hepsiburada",
    "amazon",
    "elbise",
  ],
  salary: ["maas"],
  other_income: ["prim", "ikramiye", "freelance", "satis", "harclik", "kira geliri", "gelir"],
};

/** Metinde geçen ilk kategori kelimesinin anahtarı (uzun kelimeler önce denenir). */
export function categoryKeyFor(text: string, type: "income" | "expense") {
  const n = norm(text);
  const incomeKeys = new Set(["salary", "other_income"]);
  const candidates = Object.entries(CATEGORY_KEYWORDS)
    .filter(([key]) => incomeKeys.has(key) === (type === "income"))
    .flatMap(([key, words]) => words.map((w) => ({ key, w })))
    .sort((a, b) => b.w.length - a.w.length);
  return candidates.find(({ w }) => new RegExp(`(^|\\s)${w}`).test(n))?.key ?? null;
}
