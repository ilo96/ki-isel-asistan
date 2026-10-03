import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { budgets, categories, transactions, users } from "@/server/db/schema";
import { getMonthBudgets, removeBudget, setBudget, statusOf } from "./budgets";
import { FinanceError, ensureDefaultCategories } from "./categories";
import { budgetFor } from "./dashboard/totals";
import { createTransaction } from "./transactions";

let db: Db;
let cat: (userId: string, key: string) => string;

const OCT = { start: "2026-10-01", end: "2026-10-31" };
const spend = (key: string, lira: number, occurredOn: string) =>
  createTransaction(
    db,
    "u1",
    {
      type: "expense",
      amountMinor: lira * 100,
      categoryId: cat("u1", key),
      description: "",
      note: "",
      occurredOn,
    },
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
  await db.delete(budgets);
});

describe("bütçe durumu", () => {
  it("%80'de uyarı, %100'de aşım", () => {
    expect(statusOf(0.79)).toBe("ok");
    expect(statusOf(0.8)).toBe("warning");
    expect(statusOf(1)).toBe("over");
    expect(statusOf(0.6, [50, 90])).toBe("warning");
  });
});

describe("bütçeler", () => {
  it("kategori bütçesini harcamayla, yüzdeyle ve ay sonu tahminiyle verir", async () => {
    await setBudget(db, "u1", {
      categoryId: cat("u1", "groceries"),
      amountMinor: 400_000,
      month: "2026-10",
    });
    await spend("groceries", 1_700, "2026-10-02");
    await spend("groceries", 1_700, "2026-10-09");
    await spend("food", 500, "2026-10-09");

    const m = await getMonthBudgets(db, "u1", OCT, "2026-10-10");
    expect(m.lines).toHaveLength(1);
    expect(m.lines[0]).toMatchObject({
      name: "Market",
      limitMinor: 400_000,
      spentMinor: 340_000,
      status: "warning",
      // 3.400 TL / 10 gün × 31 gün
      projectedMinor: 1_054_000,
      since: "2026-10",
    });
    expect(m.unbudgeted[0]).toMatchObject({ name: "Yemek", spentMinor: 50_000 });
    expect(m.expenseMinor).toBe(390_000);
    expect(m.daysLeft).toBe(21);
  });

  it("bütçe sonraki aylara devreder, kaldırma yalnızca o aydan itibaren geçerlidir", async () => {
    const groceries = cat("u1", "groceries");
    await setBudget(db, "u1", { categoryId: groceries, amountMinor: 300_000, month: "2026-08" });
    expect((await getMonthBudgets(db, "u1", OCT, "2026-10-10")).lines[0]?.since).toBe("2026-08");

    await removeBudget(db, "u1", { categoryId: groceries, month: "2026-10" });
    expect((await getMonthBudgets(db, "u1", OCT, "2026-10-10")).lines).toHaveLength(0);
    const sept = await getMonthBudgets(
      db,
      "u1",
      { start: "2026-09-01", end: "2026-09-30" },
      "2026-10-10",
    );
    expect(sept.lines).toHaveLength(1);
    expect(sept.lines[0]?.projectedMinor).toBeNull();
  });

  it("aynı ay için tekrar kaydetmek tutarı günceller; genel bütçe de tek satırdır", async () => {
    await setBudget(db, "u1", { categoryId: null, amountMinor: 2_000_000, month: "2026-10" });
    await setBudget(db, "u1", { categoryId: null, amountMinor: 2_500_000, month: "2026-10" });
    expect(await db.select().from(budgets)).toHaveLength(1);
    const m = await getMonthBudgets(db, "u1", OCT, "2026-10-10");
    expect(m.overall?.limitMinor).toBe(2_500_000);
  });

  it("dashboard kaldırılmış bütçeyi görmez", async () => {
    await setBudget(db, "u1", { categoryId: null, amountMinor: 1_000_000, month: "2026-09" });
    await removeBudget(db, "u1", { categoryId: null, month: "2026-10" });
    expect(await budgetFor({ db, userId: "u1", today: "2026-10-10" }, OCT)).toBeNull();
  });

  it("geçmiş 3 ayın ortalamasını 100 TL'ye yuvarlayıp öneri olarak verir", async () => {
    await spend("groceries", 3_000, "2026-07-05");
    await spend("groceries", 4_000, "2026-08-05");
    await spend("groceries", 5_050, "2026-09-05");
    const m = await getMonthBudgets(db, "u1", OCT, "2026-10-10");
    // (3.000 + 4.000 + 5.050) / 3 = 4.016,67 → 4.100
    expect(m.suggestions[cat("u1", "groceries")]).toBe(410_000);
    expect(m.overallSuggestionMinor).toBe(410_000);
  });

  it("ayın ilk haftasında tahmin yapmaz", async () => {
    await setBudget(db, "u1", { categoryId: null, amountMinor: 100_000, month: "2026-10" });
    await spend("rent", 900, "2026-10-02");
    const m = await getMonthBudgets(db, "u1", OCT, "2026-10-03");
    expect(m.overall?.projectedMinor).toBeNull();
    expect(m.overall?.status).toBe("warning");
  });

  it("başka kullanıcının kategorisine ve gelir kategorisine bütçe konamaz", async () => {
    await expect(
      setBudget(db, "u1", {
        categoryId: cat("u2", "groceries"),
        amountMinor: 100,
        month: "2026-10",
      }),
    ).rejects.toBeInstanceOf(FinanceError);
    await expect(
      setBudget(db, "u1", { categoryId: cat("u1", "salary"), amountMinor: 100, month: "2026-10" }),
    ).rejects.toThrow("category_type_mismatch");
  });
});
