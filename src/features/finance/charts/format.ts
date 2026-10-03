import { formatMoney, type CurrencyCode } from "@/lib/money";

/** Eksen etiketleri: 12.500 → "12,5 B". Tooltip'te tam tutar yazılır. */
export function axisMoney(minor: number) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(
    minor / 100,
  );
}

export function fullMoney(minor: number, currency: CurrencyCode) {
  return formatMoney(minor, { currency, compact: true });
}

/** "2026-10" → "Eki" (kısa) ya da "Ekim 2026" (uzun). */
export function monthName(month: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("tr-TR", {
    month: style,
    ...(style === "long" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
}
