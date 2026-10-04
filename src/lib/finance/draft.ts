import type { DateString } from "@/lib/dates";
import type { TransactionType } from "./types";

/** Sesle ya da fişten gelen, formu dolduran ama henüz kaydedilmemiş işlem. */
export type TransactionDraft = {
  source: "voice" | "receipt";
  type: TransactionType;
  amountMinor: number | null;
  categoryId: string | null;
  description: string;
  occurredOn: DateString;
  /** Sesle eklemede duyulan cümle; formda "Duyduğum:" diye gösterilir. */
  heard: string | null;
};
