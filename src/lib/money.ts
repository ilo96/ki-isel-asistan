/**
 * Para tutarları her yerde kuruş (minor unit) cinsinden tam sayı olarak taşınır.
 * Ondalıklı sayı yalnızca ekrana yazarken, Intl'e verilirken oluşur.
 */

export type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";

export const DEFAULT_CURRENCY: CurrencyCode = "TRY";
export const DEFAULT_LOCALE = "tr-TR";

const MINOR_PER_MAJOR = 100;

type FormatOptions = {
  currency?: CurrencyCode;
  /** "+" / "−" işaretini her zaman göster (gelir/gider satırları için). */
  signed?: boolean;
  /** Tam sayı tutarlarda kuruş hanelerini gizle: ₺25.000 */
  compact?: boolean;
  locale?: string;
};

export function formatMoney(amountMinor: number | bigint, options: FormatOptions = {}): string {
  const {
    currency = DEFAULT_CURRENCY,
    signed = false,
    compact = false,
    locale = DEFAULT_LOCALE,
  } = options;
  const minor = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Geçersiz kuruş tutarı: ${String(amountMinor)}`);
  }

  const isWhole = minor % MINOR_PER_MAJOR === 0;
  const digits = compact && isWhole ? 0 : 2;
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(minor) / MINOR_PER_MAJOR);

  if (minor < 0) return `−${formatted}`;
  if (signed && minor > 0) return `+${formatted}`;
  return formatted;
}

/** "25.000,50" gibi kullanıcı girdisini kuruşa çevirir; geçersizse null. */
export function parseMoneyInput(input: string): number | null {
  const cleaned = input.replace(/[\s₺]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.replace("-", "").split(".");
  const minor = Number(whole) * MINOR_PER_MAJOR + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) return null;
  return cleaned.startsWith("-") ? -minor : minor;
}
