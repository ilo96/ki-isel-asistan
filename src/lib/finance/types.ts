import type { DateString } from "@/lib/dates";

/*
 * İstemci ile sunucu arasında taşınan finans nesneleri. Sunucu kodunu içe aktarmaz,
 * böylece client component'ler de güvenle kullanır.
 */

export type TransactionType = "income" | "expense";

export type CategoryOption = {
  id: string;
  type: TransactionType;
  name: string;
  icon: string;
  colorToken: string;
  systemKey: string | null;
  archived: boolean;
  /** Son 90 gündeki işlem sayısı; hızlı ekle'de en çok kullanılanlar öne çıkar. */
  usage: number;
};

/** Listede bir satır; düzenleme sheet'i aynı nesneyle açılır. */
export type TransactionItem = {
  id: string;
  type: TransactionType;
  amountMinor: number;
  description: string;
  note: string | null;
  occurredOn: DateString;
  category: { id: string; name: string; icon: string; colorToken: string };
};
