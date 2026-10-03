"use client";

import { useShell } from "@/components/layout/ui-store";
import { Amount } from "@/components/ui/amount";
import { CategoryIcon } from "@/features/dashboard/category-icon";
import type { TransactionItem } from "@/lib/finance/types";
import type { CurrencyCode } from "@/lib/money";

type Props = {
  item: TransactionItem;
  currency: CurrencyCode;
  /** Kategori adının yanında gösterilecek ek bilgi (ör. "Dün"). */
  meta?: string;
};

/** Bir işlem satırı; dokununca düzenleme sheet'i açılır. */
export function TransactionRow({ item, currency, meta }: Props) {
  const { edit } = useShell();
  // Açıklama boş bırakılıp kategori adını aldıysa alt satırda tekrar yazılmaz.
  const details = [
    item.description === item.category.name ? null : item.category.name,
    meta,
    item.note,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => edit(item)}
      className="flex min-h-14 w-full items-center gap-3 rounded-input px-2 py-2 text-left transition-colors duration-[120ms] hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
    >
      <CategoryIcon icon={item.category.icon} colorToken={item.category.colorToken} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-text">{item.description}</span>
        {details.length > 0 && (
          <span className="block truncate text-small text-muted">{details.join(" · ")}</span>
        )}
      </span>
      <Amount minor={item.amountMinor} currency={currency} kind={item.type} className="text-body" />
    </button>
  );
}
