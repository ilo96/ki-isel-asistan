import type { Db } from "@/server/db/client";
import { categories } from "@/server/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";

/** Transaction içinden de çağrılabilsin diye hem Db hem tx kabul edilir. */
type DbOrTx = Pick<Db, "insert">;

/**
 * Varsayılan kategorileri kullanıcıya kopyalar. Tekrar çağrılırsa eksik olanları ekler,
 * var olanlara (adı değiştirilmiş olsa bile) dokunmaz.
 */
export async function ensureDefaultCategories(db: DbOrTx, userId: string) {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, userId, sortOrder: i })))
    .onConflictDoNothing({ target: [categories.userId, categories.systemKey] });
}
