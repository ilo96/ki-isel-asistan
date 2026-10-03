import { and, asc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import type { CategoryOption } from "@/lib/finance/types";
import { categoryInputSchema, type CategoryInput } from "@/lib/validation/finance";
import type { Db } from "@/server/db/client";
import { categories, transactions } from "@/server/db/schema";

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

/* --------------------------------------------------------------- Yönetim */

/** Finans servislerinin kullanıcıya gösterilebilir hataları; kod i18n anahtarıdır. */
export class FinanceError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "category_not_found"
      | "category_type_mismatch"
      | "category_archived"
      | "last_category",
  ) {
    super(code);
    this.name = "FinanceError";
  }
}

const USAGE_DAYS = 90;

/**
 * Kullanıcının kategorileri, sıralama düzeninde. usage son 90 günün işlem sayısıdır;
 * arşivlenmiş kategoriler yalnızca istenirse gelir (eski işlemleri düzenlerken gerekir).
 */
export async function listCategories(
  db: Db,
  userId: string,
  { includeArchived = false, now = new Date() }: { includeArchived?: boolean; now?: Date } = {},
): Promise<CategoryOption[]> {
  const since = new Date(now.getTime() - USAGE_DAYS * 86_400_000);
  const usage = db
    .select({
      categoryId: transactions.categoryId,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.createdAt, since),
      ),
    )
    .groupBy(transactions.categoryId)
    .as("usage");

  const rows = await db
    .select({
      id: categories.id,
      type: categories.type,
      name: categories.name,
      icon: categories.icon,
      colorToken: categories.colorToken,
      systemKey: categories.systemKey,
      archivedAt: categories.archivedAt,
      usage: usage.count,
    })
    .from(categories)
    .leftJoin(usage, eq(usage.categoryId, categories.id))
    .where(
      and(
        eq(categories.userId, userId),
        includeArchived ? undefined : isNull(categories.archivedAt),
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));

  return rows.map(({ archivedAt, usage: count, ...c }) => ({
    ...c,
    archived: archivedAt !== null,
    usage: count ?? 0,
  }));
}

/** Kategori kullanıcıya ait mi ve verilen türde mi; değilse FinanceError atar. */
export async function assertCategory(
  db: Pick<Db, "select">,
  userId: string,
  categoryId: string,
  type: "income" | "expense",
  { allowArchived = false } = {},
) {
  const [row] = await db
    .select({ type: categories.type, archivedAt: categories.archivedAt })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  if (!row) throw new FinanceError("category_not_found");
  if (row.type !== type) throw new FinanceError("category_type_mismatch");
  if (row.archivedAt && !allowArchived) throw new FinanceError("category_archived");
}

export async function createCategory(db: Db, userId: string, input: CategoryInput) {
  const data = categoryInputSchema.parse(input);
  const [last] = await db
    .select({ max: sql<number | null>`max(${categories.sortOrder})` })
    .from(categories)
    .where(eq(categories.userId, userId));
  const [row] = await db
    .insert(categories)
    .values({ ...data, userId, sortOrder: (last?.max ?? -1) + 1 })
    .returning({ id: categories.id });
  return row!;
}

/** Ad, ikon ve renk değişir; tür değişmez (geçmiş işlemlerin yönü bozulmasın). */
export async function updateCategory(
  db: Db,
  userId: string,
  id: string,
  input: Omit<CategoryInput, "type">,
) {
  const data = categoryInputSchema.omit({ type: true }).parse(input);
  const [row] = await db
    .update(categories)
    .set(data)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  if (!row) throw new FinanceError("category_not_found");
  return row;
}

/**
 * Kategoriler silinmez, arşivlenir: geçmiş işlemler adını ve rengini korur.
 * Bir türün son aktif kategorisi arşivlenemez, yoksa o türde işlem eklenemezdi.
 */
export async function setCategoryArchived(
  db: Db,
  userId: string,
  id: string,
  archived: boolean,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [cat] = await tx
      .select({ type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) throw new FinanceError("category_not_found");
    if (archived) {
      const [active] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.type, cat.type),
            isNull(categories.archivedAt),
            ne(categories.id, id),
          ),
        );
      if ((active?.count ?? 0) === 0) throw new FinanceError("last_category");
    }
    await tx
      .update(categories)
      .set({ archivedAt: archived ? now : null })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  });
}
