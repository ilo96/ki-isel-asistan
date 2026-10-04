"use server";

import type { TransactionItem } from "@/lib/finance/types";
import type { LifeItem } from "@/lib/life/types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { searchLife } from "@/server/services/life-overview";
import { listTransactions } from "@/server/services/transactions";

export type SearchResults = {
  transactions: TransactionItem[];
  life: LifeItem[];
  currency: CurrencyCode;
};

/** Komut paletinin kayıt araması: işlemler ve açık hatırlatıcı/görevler. */
export async function searchAction(query: string): Promise<SearchResults> {
  const q = query.trim().slice(0, 80);
  const session = await getSession();
  if (!session || q.length < 2) return { transactions: [], life: [], currency: DEFAULT_CURRENCY };
  const db = await getDb();
  const user = { id: session.user.id, timezone: session.user.timezone ?? DEFAULT_TIMEZONE };
  const [tx, life] = await Promise.all([
    listTransactions(db, user.id, { q, limit: 5 }),
    searchLife(db, user, q),
  ]);
  return {
    transactions: tx.items,
    life,
    currency: (session.user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
  };
}
