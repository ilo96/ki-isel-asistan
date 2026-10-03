import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { groupByDay } from "@/lib/finance/group";
import { createPgliteDb, type Db } from "@/server/db/client";
import { categories, transactions, users } from "@/server/db/schema";
import {
  createCategory,
  ensureDefaultCategories,
  FinanceError,
  listCategories,
  setCategoryArchived,
  updateCategory,
} from "./categories";
import { getMonthOverview } from "./finance-overview";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from "./transactions";

let db: Db;
let cat: (userId: string, key: string) => string;

const base = { description: "", note: "", occurredOn: "2026-10-03" };
const expense = (userId: string, key: string, lira: number, extra: Partial<typeof base> = {}) =>
  createTransaction(
    db,
    userId,
    { ...base, ...extra, type: "expense", amountMinor: lira * 100, categoryId: cat(userId, key) },
    { currency: "TRY" },
  );

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"]) {
    await db.insert(users).values({ id, name: "Ayşe", email: `${id}@example.com` });
    await ensureDefaultCategories(db, id);
  }
  const rows = await db.select().from(categories);
  cat = (u, k) => rows.find((c) => c.userId === u && c.systemKey === k)!.id;
});

beforeEach(async () => {
  await db.delete(transactions);
});

describe("işlemler", () => {
  it("ekler; açıklama boşsa kategori adını kullanır ve notu null yapar", async () => {
    const { id } = await expense("u1", "groceries", 350);
    const tx = await getTransaction(db, "u1", id);
    expect(tx).toMatchObject({
      type: "expense",
      amountMinor: 35_000,
      description: "Market",
      note: null,
      occurredOn: "2026-10-03",
      category: { name: "Market" },
    });
  });

  it("başka kullanıcının kategorisini ve yanlış türdeki kategoriyi reddeder", async () => {
    await expect(
      expense("u1", "groceries", 1).then(() => expense("u2", "food", 1)),
    ).resolves.toBeTruthy();
    await expect(
      createTransaction(
        db,
        "u1",
        { ...base, type: "expense", amountMinor: 100, categoryId: cat("u2", "food") },
        { currency: "TRY" },
      ),
    ).rejects.toThrow(new FinanceError("category_not_found"));
    await expect(
      createTransaction(
        db,
        "u1",
        { ...base, type: "income", amountMinor: 100, categoryId: cat("u1", "food") },
        { currency: "TRY" },
      ),
    ).rejects.toThrow(new FinanceError("category_type_mismatch"));
  });

  it("geçersiz tutarı ve tarihi kabul etmez", async () => {
    await expect(expense("u1", "food", 0)).rejects.toThrow();
    await expect(expense("u1", "food", 10, { occurredOn: "2026-13-01" })).rejects.toThrow();
  });

  it("günceller, siler ve geri alır; başka kullanıcı dokunamaz", async () => {
    const { id } = await expense("u1", "food", 100, { description: "Öğle" });
    await updateTransaction(db, "u1", id, {
      ...base,
      type: "expense",
      amountMinor: 12_050,
      categoryId: cat("u1", "transport"),
      description: "Taksi",
      note: "Havalimanı",
    });
    expect(await getTransaction(db, "u1", id)).toMatchObject({
      amountMinor: 12_050,
      description: "Taksi",
      note: "Havalimanı",
      category: { name: "Ulaşım" },
    });

    await expect(deleteTransaction(db, "u2", id)).rejects.toThrow(FinanceError);
    await deleteTransaction(db, "u1", id);
    expect(await getTransaction(db, "u1", id)).toBeNull();
    await expect(deleteTransaction(db, "u1", id)).rejects.toThrow(FinanceError);

    await restoreTransaction(db, "u1", id);
    expect(await getTransaction(db, "u1", id)).not.toBeNull();
  });

  it("filtreler, arar ve sayfalar", async () => {
    await expense("u1", "groceries", 100, {
      description: "Haftalık market",
      occurredOn: "2026-10-01",
    });
    await expense("u1", "food", 200, {
      description: "Kahve %50 indirim",
      occurredOn: "2026-10-02",
    });
    await expense("u1", "food", 300, { description: "Akşam", occurredOn: "2026-09-28" });
    await createTransaction(
      db,
      "u1",
      { ...base, type: "income", amountMinor: 5_000_000, categoryId: cat("u1", "salary") },
      { currency: "TRY" },
    );
    await expense("u2", "food", 999, { description: "Kahve" });

    const october = await listTransactions(db, "u1", { start: "2026-10-01", end: "2026-10-31" });
    expect(october.items.map((t) => t.amountMinor)).toEqual([5_000_000, 20_000, 10_000]);

    const food = await listTransactions(db, "u1", { categoryId: cat("u1", "food") });
    expect(food.items).toHaveLength(2);

    expect((await listTransactions(db, "u1", { type: "income" })).items).toHaveLength(1);
    // Kategori adında ve büyük/küçük harf duyarsız arama
    expect((await listTransactions(db, "u1", { q: "MARKET" })).items).toHaveLength(1);
    expect((await listTransactions(db, "u1", { q: "yemek" })).items).toHaveLength(2);
    // % karakteri joker değil
    expect((await listTransactions(db, "u1", { q: "%50" })).items).toHaveLength(1);
    expect((await listTransactions(db, "u1", { q: "%" })).items).toHaveLength(1);

    const page = await listTransactions(db, "u1", { limit: 2 });
    expect(page).toMatchObject({ hasMore: true });
    expect(page.items).toHaveLength(2);

    const groups = groupByDay(october.items);
    expect(groups.map((g) => [g.day, g.netMinor])).toEqual([
      ["2026-10-03", 5_000_000],
      ["2026-10-02", -20_000],
      ["2026-10-01", -10_000],
    ]);
  });
});

describe("kategoriler", () => {
  it("ekler, düzenler, kullanım sayısını verir ve arşivler", async () => {
    const { id } = await createCategory(db, "u1", {
      type: "expense",
      name: "Kedi",
      icon: "paw-print",
      colorToken: "cat-3",
    });
    await updateCategory(db, "u1", id, {
      name: "Kedi maması",
      icon: "paw-print",
      colorToken: "cat-4",
    });
    await expense("u1", "groceries", 1);
    await expense("u1", "groceries", 1);

    const list = await listCategories(db, "u1");
    expect(list.at(-1)).toMatchObject({ name: "Kedi maması", colorToken: "cat-4", usage: 0 });
    expect(list.find((c) => c.systemKey === "groceries")?.usage).toBe(2);

    await setCategoryArchived(db, "u1", id, true);
    expect((await listCategories(db, "u1")).some((c) => c.id === id)).toBe(false);
    expect(
      (await listCategories(db, "u1", { includeArchived: true })).find((c) => c.id === id),
    ).toMatchObject({ archived: true });

    // Arşivdeki kategoriye yeni işlem eklenemez
    await expect(
      createTransaction(
        db,
        "u1",
        { ...base, type: "expense", amountMinor: 100, categoryId: id },
        { currency: "TRY" },
      ),
    ).rejects.toThrow(new FinanceError("category_archived"));

    await expect(
      updateCategory(db, "u2", id, { name: "x", icon: "car", colorToken: "cat-1" }),
    ).rejects.toThrow(FinanceError);
  });

  it("bir türün son aktif kategorisini arşivletmez", async () => {
    await setCategoryArchived(db, "u2", cat("u2", "other_income"), true);
    await expect(setCategoryArchived(db, "u2", cat("u2", "salary"), true)).rejects.toThrow(
      new FinanceError("last_category"),
    );
    await setCategoryArchived(db, "u2", cat("u2", "other_income"), false);
  });
});

describe("aylık özet", () => {
  it("gelir, gider, kategori payları ve kıyası hesaplar", async () => {
    await expense("u1", "groceries", 300, { occurredOn: "2026-10-01" });
    await expense("u1", "food", 100, { occurredOn: "2026-10-03" });
    await expense("u1", "food", 400, { occurredOn: "2026-09-02" });
    await expense("u1", "food", 999, { occurredOn: "2026-09-20" }); // aynı güne kadar kıyasa girmez
    await createTransaction(
      db,
      "u1",
      { ...base, type: "income", amountMinor: 100_000, categoryId: cat("u1", "salary") },
      { currency: "TRY" },
    );

    const o = await getMonthOverview(
      db,
      "u1",
      { start: "2026-10-01", end: "2026-10-31" },
      "2026-10-03",
    );
    expect(o).toMatchObject({
      isCurrent: true,
      incomeMinor: 100_000,
      expenseMinor: 40_000,
      netMinor: 60_000,
      previousExpenseMinor: 40_000,
      dailyAverageMinor: 13_333,
    });
    expect(o.expenseByCategory.map((c) => [c.name, c.percent])).toEqual([
      ["Market", 75],
      ["Yemek", 25],
    ]);

    // Geçmiş ay önceki ayın tamamıyla kıyaslanır
    const sept = await getMonthOverview(
      db,
      "u1",
      { start: "2026-09-01", end: "2026-09-30" },
      "2026-10-03",
    );
    expect(sept).toMatchObject({
      isCurrent: false,
      expenseMinor: 139_900,
      previousExpenseMinor: 0,
    });

    const deleted = await db
      .select()
      .from(transactions)
      .where(eq(transactions.amountMinor, 99_900));
    await deleteTransaction(db, "u1", deleted[0]!.id);
    const after = await getMonthOverview(
      db,
      "u1",
      { start: "2026-09-01", end: "2026-09-30" },
      "2026-10-03",
    );
    expect(after.expenseMinor).toBe(40_000);
  });
});
