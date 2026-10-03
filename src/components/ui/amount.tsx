"use client";

import { cn } from "@/lib/cn";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { AnimatedNumber } from "./animated-number";

type AmountProps = {
  /** Kuruş cinsinden tutar */
  minor: number;
  currency?: CurrencyCode;
  /** income: yeşil ve "+", expense: kırmızı ve "−". Renk tek başına anlam taşımaz. */
  kind?: "neutral" | "income" | "expense";
  animated?: boolean;
  compact?: boolean;
  className?: string;
};

export function Amount({
  minor,
  currency,
  kind = "neutral",
  animated = false,
  compact = false,
  className,
}: AmountProps) {
  const signedValue = kind === "expense" ? -Math.abs(minor) : minor;
  const format = (v: number) =>
    formatMoney(v, { currency, compact, signed: kind === "income" });
  const classes = cn(
    "money",
    kind === "income" && "text-positive",
    kind === "expense" && "text-negative",
    className,
  );
  if (animated) return <AnimatedNumber value={signedValue} format={format} className={classes} />;
  return <span className={classes}>{format(signedValue)}</span>;
}
