import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { categories, users } from "@/server/db/schema";
import { ensureDefaultCategories } from "./categories";
import { getCumulativeExpense, getMonthlySeries } from "./finance-trends";
import { createTransaction, deleteTransaction } from "./transactions";

let db: Db;
let cat: (key: string) => string;

const add = (type: "income" | "expense", key: string, lira: number, occurredOn: string) =>
  createTransaction(
    db,
    "u1",
    { type, amountMinor: lira * 100, categoryId: cat(key), description: "", note: "", occurredOn },
    { currency: "TRY" },
  );

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"]) {
    await db.insert(users).values({ id, name: "Ayşe", email: `${id}@example.com` });
    await ensureDefaultCategories(db, id);
  }
  const rows = await db.select().from(categories);
  cat = (k) => rows.find((c) => c.userId === "u1" && c.systemKey === k)!.id;

  await add("income", "salary", 40_000, "2026-08-01");
  await add("expense", "rent", 18_000, "2026-08-02");
  await add("expense", "groceries", 1_000, "2026-09-03");
  await add("expense", "food", 500, "2026-09-10");
  await add("expense", "groceries", 700, "2026-10-01");
  await add("expense", "food", 300, "2026-10-03");
  const deleted = await add("expense", "food", 9_999, "2026-10-02");
  await deleteTransaction(db, "u1", deleted.id);
});

describe("aylık seri", () => {
  it("boş ayları sıfırla doldurur, eskiden yeniye sıralar ve silinenleri saymaz", async () => {
    const series = await getMonthlySeries(db, "u1", "2026-10", 4);
    expect(series).toEqual([
      { month: "2026-07", incomeMinor: 0, expenseMinor: 0, netMinor: 0 },
      { month: "2026-08", incomeMinor: 4_000_000, expenseMinor: 1_800_000, netMinor: 2_200_000 },
      { month: "2026-09", incomeMinor: 0, expenseMinor: 150_000, netMinor: -150_000 },
      { month: "2026-10", incomeMinor: 0, expenseMinor: 100_000, netMinor: -100_000 },
    ]);
  });

  it("başka kullanıcının işlemlerini görmez", async () => {
    const series = await getMonthlySeries(db, "u2", "2026-10", 3);
    expect(series.every((p) => p.incomeMinor === 0 && p.expenseMinor === 0)).toBe(true);
  });

  it("yıl sınırını geçer", async () => {
    const series = await getMonthlySeries(db, "u1", "2027-01", 3);
    expect(series.map((p) => p.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("birikimli gider", () => {
  it("bu ayı bugünde keser, geçen ayı ayın uzunluğu kadar çizer", async () => {
    const points = await getCumulativeExpense(
      db,
      "u1",
      { start: "2026-10-01", end: "2026-10-31" },
      "2026-10-03",
    );
    expect(points).toHaveLength(31);
    expect(points[0]).toEqual({ day: 1, current: 70_000, previous: 0 });
    expect(points[2]).toEqual({ day: 3, current: 100_000, previous: 100_000 });
    expect(points[3]?.current).toBeNull();
    expect(points[9]?.previous).toBe(150_000);
    // Eylül 30 gün: 31. günün karşılığı yok.
    expect(points[30]?.previous).toBeNull();
  });

  it("geçmiş bir ayda bütün günleri doldurur", async () => {
    const points = await getCumulativeExpense(
      db,
      "u1",
      { start: "2026-09-01", end: "2026-09-30" },
      "2026-10-03",
    );
    expect(points.at(-1)).toEqual({ day: 30, current: 150_000, previous: 1_800_000 });
  });
});
