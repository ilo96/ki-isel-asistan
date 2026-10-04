"use server";

import { revalidatePath } from "next/cache";
import { dayIn, DEFAULT_TIMEZONE, type DateString } from "@/lib/dates";
import type { CategoryOption } from "@/lib/finance/types";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import {
  categoryInputSchema,
  transactionInputSchema,
  type CategoryInput,
  type TransactionInput,
} from "@/lib/validation/finance";
import { receiptReadable } from "@/server/ai/receipt";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  createCategory,
  FinanceError,
  listCategories,
  setCategoryArchived,
  updateCategory,
} from "@/server/services/categories";
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from "@/server/services/transactions";

/*
 * Finans ekranlarının server action'ları. Her biri oturumdan userId alır, girdiyi aynı
 * Zod şemasıyla yeniden doğrular ve iş mantığını servislere bırakır.
 */

export type ActionError = "unauthorized" | "invalid" | "unknown" | FinanceError["code"];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run<T>(
  label: string,
  fn: (user: { id: string; currency: CurrencyCode; timezone: string }) => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: ActionError }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const user = {
    id: session.user.id,
    currency: (session.user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
    timezone: session.user.timezone ?? DEFAULT_TIMEZONE,
  };
  try {
    const data = await fn(user);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof FinanceError) return { ok: false, error: error.code };
    console.error(label, error);
    return { ok: false, error: "unknown" };
  }
}

/** Sayfa, dashboard ve hızlı ekle aynı veriyi gösterdiği için tüm uygulama yenilenir. */
function refresh() {
  revalidatePath("/", "layout");
}

export type QuickAddData = {
  categories: CategoryOption[];
  today: DateString;
  currency: CurrencyCode;
  /** Fiş okuma sunucuda yapılandırıldı mı (ANTHROPIC_API_KEY). */
  receiptScan: boolean;
};

/** Hızlı ekle sheet'i açılırken bir kez çağrılır. */
export async function getQuickAddDataAction(): Promise<
  { ok: true; data: QuickAddData } | { ok: false; error: ActionError }
> {
  return run("Hızlı ekle verisi alınamadı", async (user) => ({
    categories: await listCategories(await getDb(), user.id, { includeArchived: true }),
    today: dayIn(new Date(), user.timezone),
    currency: user.currency,
    receiptScan: receiptReadable(),
  }));
}

export async function saveTransactionAction(
  id: string | null,
  input: TransactionInput,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: ActionError }> {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid.test(id))) return { ok: false, error: "invalid" };
  const result = await run("İşlem kaydedilemedi", async (user) => {
    const db = await getDb();
    return id
      ? updateTransaction(db, user.id, id, input)
      : createTransaction(db, user.id, input, { currency: user.currency });
  });
  if (result.ok) refresh();
  return result;
}

export async function deleteTransactionAction(id: string) {
  if (!uuid.test(id)) return { ok: false as const, error: "invalid" as const };
  const result = await run("İşlem silinemedi", async (user) =>
    deleteTransaction(await getDb(), user.id, id),
  );
  if (result.ok) refresh();
  return result;
}

export async function restoreTransactionAction(id: string) {
  if (!uuid.test(id)) return { ok: false as const, error: "invalid" as const };
  const result = await run("İşlem geri alınamadı", async (user) =>
    restoreTransaction(await getDb(), user.id, id),
  );
  if (result.ok) refresh();
  return result;
}

export async function saveCategoryAction(id: string | null, input: CategoryInput) {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid.test(id))) {
    return { ok: false as const, error: "invalid" as const };
  }
  const result = await run("Kategori kaydedilemedi", async (user) => {
    const db = await getDb();
    // Tür yalnızca eklerken seçilir; güncellemede şema onu dışarıda bırakır.
    return id
      ? updateCategory(db, user.id, id, parsed.data)
      : createCategory(db, user.id, parsed.data);
  });
  if (result.ok) refresh();
  return result;
}

export async function archiveCategoryAction(id: string, archived: boolean) {
  if (!uuid.test(id)) return { ok: false as const, error: "invalid" as const };
  const result = await run("Kategori arşivlenemedi", async (user) =>
    setCategoryArchived(await getDb(), user.id, id, archived),
  );
  if (result.ok) refresh();
  return result;
}
