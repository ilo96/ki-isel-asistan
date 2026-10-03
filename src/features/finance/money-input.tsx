"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { CurrencyCode } from "@/lib/money";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  currency: CurrencyCode;
  value: string;
};

/** Büyük tutar alanı: simge rakamın hemen solunda, alan yazılan kadar genişler. */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { currency, value, className, ...props },
  ref,
) {
  const width = `${Math.min(Math.max(value.length, 1), 14) + 0.5}ch`;
  return (
    <div
      className={cn(
        "flex items-baseline justify-center gap-1 overflow-hidden rounded-card bg-surface-muted px-4 py-5 text-text",
        className,
      )}
    >
      <span aria-hidden className="text-h1 text-muted">
        {CURRENCY_SYMBOLS[currency]}
      </span>
      <input
        ref={ref}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        style={{ width }}
        className="max-w-full min-w-0 bg-transparent text-display money placeholder:text-muted/60 focus:outline-none"
        {...props}
      />
    </div>
  );
});
