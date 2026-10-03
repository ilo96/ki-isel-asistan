import { and, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { DateString } from "@/lib/dates";
import type { TransactionItem } from "@/lib/finance/types";
import type { CurrencyCode } from "@/lib/money";
import {
  transactionInputSchema,
  type TransactionFilter,
  type TransactionInput,
} from "@/lib/validation/finance";
import type { Db } from "@/server/db/client";
import { categories, transactions } from "@/server/db/schema";
import { assertCategory, FinanceError } from "./categories";

/*
 * İşlem ekleme, düzenleme, silme ve listeleme. Arayüz ve (ileride) asistanın tool'ları
 * aynı fonksiyonları çağırır; her fonksiyon userId alır ve yalnızca o kullanıcının
 * satırlarına dokunur. Silme yumuşaktır (deleted_at), geri al bunu kullanır.
 */

type Source = "manual" | "ai" | "recurring";

const own = (userId: string, id: string) =>
  and(eq(transactions.id, id), eq(transactions.userId, userId));

/** Açıklama boşsa listede kategori adı görünür. */
async function describe(db: Pick<Db, "select">, categoryId: string, description: string) {
  if (description) return description;
  const [cat] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  return cat?.name ?? "";
}

export async function createTransaction(
  db: Db,
  userId: string,
  input: TransactionInput,
  { currency, source = "manual" }: { currency: CurrencyCode; source?: Source },
) {
  const data = transactionInputSchema.parse(input);
  await assertCategory(db, userId, data.categoryId, data.type);
  const [row] = await db
    .insert(transactions)
    .values({
      ...data,
      description: await describe(db, data.categoryId, data.description),
      userId,
      currency,
      source,
    })
    .returning({ id: transactions.id });
  return row!;
}

/**
 * İşlemi günceller. Arşivlenmiş bir kategoride kalan eski işlem düzenlenebilsin diye
 * kategori değişmediyse arşiv kontrolü yapılmaz.
 */
export async function updateTransaction(
  db: Db,
  userId: string,
  id: string,
  input: TransactionInput,
) {
  const data = transactionInputSchema.parse(input);
  const [current] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(and(own(userId, id), isNull(transactions.deletedAt)))
    .limit(1);
  if (!current) throw new FinanceError("not_found");
  await assertCategory(db, userId, data.categoryId, data.type, {
    allowArchived: current.categoryId === data.categoryId,
  });
  await db
    .update(transactions)
    .set({ ...data, description: await describe(db, data.categoryId, data.description) })
    .where(own(userId, id));
  return { id };
}

export async function deleteTransaction(db: Db, userId: string, id: string, now = new Date()) {
  const [row] = await db
    .update(transactions)
    .set({ deletedAt: now })
    .where(and(own(userId, id), isNull(transactions.deletedAt)))
    .returning({ id: transactions.id });
  if (!row) throw new FinanceError("not_found");
  return row;
}

/** Geri al: yumuşak silinmiş işlemi geri getirir. */
export async function restoreTransaction(db: Db, userId: string, id: string) {
  const [row] = await db
    .update(transactions)
    .set({ deletedAt: null })
    .where(and(own(userId, id), isNotNull(transactions.deletedAt)))
    .returning({ id: transactions.id });
  if (!row) throw new FinanceError("not_found");
  return row;
}

/** LIKE desenindeki özel karakterleri kaçırır: "%50" araması gerçekten "%50" arar. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const itemColumns = {
  id: transactions.id,
  type: transactions.type,
  amountMinor: transactions.amountMinor,
  description: transactions.description,
  note: transactions.note,
  occurredOn: transactions.occurredOn,
  categoryId: categories.id,
  name: categories.name,
  icon: categories.icon,
  colorToken: categories.colorToken,
};

type ItemRow = Omit<TransactionItem, "category"> & {
  categoryId: string;
  name: string;
  icon: string;
  colorToken: string;
};

export type ListOptions = TransactionFilter & {
  start?: DateString;
  end?: DateString;
  limit?: number;
};

export const DEFAULT_PAGE_SIZE = 50;

/**
 * Filtreli işlem listesi, en yeni gün üstte. Arama açıklama, not ve kategori adında
 * büyük/küçük harf duyarsız yapılır. hasMore bir sonraki sayfanın varlığını söyler.
 */
export async function listTransactions(
  db: Db,
  userId: string,
  { start, end, type, categoryId, q, limit = DEFAULT_PAGE_SIZE }: ListOptions = {},
): Promise<{ items: TransactionItem[]; hasMore: boolean }> {
  const search = q ? likePattern(q) : null;
  const rows = await db
    .select(itemColumns)
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        start ? gte(transactions.occurredOn, start) : undefined,
        end ? lte(transactions.occurredOn, end) : undefined,
        type ? eq(transactions.type, type) : undefined,
        categoryId ? eq(transactions.categoryId, categoryId) : undefined,
        search
          ? or(
              ilike(transactions.description, search),
              ilike(transactions.note, search),
              ilike(categories.name, search),
            )
          : undefined,
      ),
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit + 1);

  return {
    items: rows.slice(0, limit).map(toItem),
    hasMore: rows.length > limit,
  };
}

export async function getTransaction(
  db: Db,
  userId: string,
  id: string,
): Promise<TransactionItem | null> {
  const [row] = await db
    .select(itemColumns)
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(own(userId, id), isNull(transactions.deletedAt)))
    .limit(1);
  return row ? toItem(row) : null;
}

function toItem({ categoryId, name, icon, colorToken, ...t }: ItemRow): TransactionItem {
  return { ...t, category: { id: categoryId, name, icon, colorToken } };
}

/** Silinmemiş işlem sayısı; Finans ekranı hiç işlem yoksa ilk açılış görünümünü gösterir. */
export async function countTransactions(
  db: Db,
  userId: string,
  { start, end }: { start?: DateString; end?: DateString } = {},
) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        start ? gte(transactions.occurredOn, start) : undefined,
        end ? lte(transactions.occurredOn, end) : undefined,
      ),
    );
  return row?.count ?? 0;
}
