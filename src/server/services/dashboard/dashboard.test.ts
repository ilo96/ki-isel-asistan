import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import {
  budgets,
  categories,
  financialGoals,
  reminders,
  transactions,
  users,
} from "@/server/db/schema";
import { ensureDefaultCategories } from "../categories";
import { clearFinanceData, seedDemoData } from "../demo-data";
import { buildInsights, getDashboard } from "./index";

// 3 Ekim 2026, İstanbul'da 15:00
const NOW = new Date("2026-10-03T12:00:00Z");
const TZ = "Europe/Istanbul";

let db: Db;
let catId: (key: string) => string;

async function createUser(id: string) {
  await db.insert(users).values({ id, name: "Ayşe", email: `${id}@example.com`, onboardedAt: NOW });
  await ensureDefaultCategories(db, id);
}

async function addTx(
  userId: string,
  key: string,
  type: "income" | "expense",
  lira: number,
  on: string,
) {
  await db.insert(transactions).values({
    userId,
    type,
    amountMinor: lira * 100,
    currency: "TRY",
    categoryId: catId(`${userId}:${key}`),
    description: key,
    occurredOn: on,
  });
}

beforeAll(async () => {
  db = await createPgliteDb();
  await createUser("u1");
  await createUser("u2");
  const rows = await db.select().from(categories);
  catId = (k) => rows.find((c) => `${c.userId}:${c.systemKey}` === k)!.id;
});

beforeEach(async () => {
  await clearFinanceData(db, "u1");
  await clearFinanceData(db, "u2");
  await db.delete(financialGoals);
});

describe("dashboard", () => {
  it("yeni kullanıcı için boş ve sıfır döner", async () => {
    const d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.isEmpty).toBe(true);
    expect(d).toMatchObject({
      balanceMinor: 0,
      incomeMinor: 0,
      expenseMinor: 0,
      budget: null,
      goal: null,
    });
    expect(d.today).toBe("2026-10-03");
    expect(d.daysLeftInMonth).toBe(28);
    expect(buildInsights(d)).toEqual([]);
  });

  it("varsayılan kategoriler bir kez kopyalanır", async () => {
    await ensureDefaultCategories(db, "u1");
    const rows = await db.select().from(categories).where(eq(categories.userId, "u1"));
    expect(rows).toHaveLength(11);
  });

  it("ay toplamlarını, bakiyeyi ve geçen ayla kıyası hesaplar; başka kullanıcıyı saymaz", async () => {
    await addTx("u1", "salary", "income", 40_000, "2026-10-01");
    await addTx("u1", "groceries", "expense", 1_000, "2026-10-02");
    await addTx("u1", "food", "expense", 500, "2026-10-03");
    await addTx("u1", "groceries", "expense", 2_000, "2026-09-02"); // geçen ay, aynı döneme dahil
    await addTx("u1", "groceries", "expense", 9_000, "2026-09-20"); // geçen ay, kıyas dışında
    await addTx("u2", "groceries", "expense", 7_777, "2026-10-02");

    const d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.isEmpty).toBe(false);
    expect(d.incomeMinor).toBe(4_000_000);
    expect(d.expenseMinor).toBe(150_000);
    expect(d.previousExpenseToDateMinor).toBe(200_000);
    expect(d.balanceMinor).toBe((40_000 - 1_000 - 500 - 2_000 - 9_000) * 100);
    expect(d.topCategory).toEqual({ name: "Market", amountMinor: 100_000 });
    expect(d.recent.map((r) => r.description)).toEqual([
      "food",
      "groceries",
      "salary",
      "groceries",
      "groceries",
    ]);
    expect(d.recent[0]?.daysAgo).toBe(0);
    expect(buildInsights(d)).toEqual([
      { key: "expenseDown", percent: 25 },
      { key: "topCategory", name: "Market", amountMinor: 100_000 },
    ]);
  });

  it("silinen işlemleri saymaz", async () => {
    await addTx("u1", "food", "expense", 500, "2026-10-03");
    await db.update(transactions).set({ deletedAt: NOW });
    const d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.expenseMinor).toBe(0);
    expect(d.isEmpty).toBe(true);
  });

  it("genel bütçe kategori bütçelerinin önüne geçer; en son girilen tutar geçerlidir", async () => {
    await addTx("u1", "groceries", "expense", 900, "2026-10-02");
    await addTx("u1", "food", "expense", 100, "2026-10-02");
    await db.insert(budgets).values([
      {
        userId: "u1",
        categoryId: catId("u1:groceries"),
        amountMinor: 50_000,
        startsOn: "2026-08-01",
      },
      {
        userId: "u1",
        categoryId: catId("u1:groceries"),
        amountMinor: 100_000,
        startsOn: "2026-09-01",
      },
      {
        userId: "u1",
        categoryId: catId("u1:groceries"),
        amountMinor: 999_999,
        startsOn: "2026-11-01",
      },
    ]);
    let d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.budget).toEqual({ limitMinor: 100_000, spentMinor: 90_000, scope: "categories" });
    expect(buildInsights(d)[0]).toEqual({ key: "budgetHigh", percent: 90, daysLeft: 28 });

    await db.insert(budgets).values({ userId: "u1", amountMinor: 80_000, startsOn: "2026-10-01" });
    d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.budget).toEqual({ limitMinor: 80_000, spentMinor: 100_000, scope: "overall" });
    expect(buildInsights(d)[0]).toEqual({ key: "budgetOver", overMinor: 20_000 });
  });

  it("birikim hedefinde dönemdeki gelir eksi gideri gösterir", async () => {
    await db.insert(financialGoals).values({
      userId: "u1",
      kind: "saving",
      title: "Aylık birikim",
      targetMinor: 500_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
    });
    await addTx("u1", "salary", "income", 10_000, "2026-10-01");
    await addTx("u1", "rent", "expense", 8_000, "2026-10-01");
    const d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.goal).toEqual({ title: "Aylık birikim", targetMinor: 500_000, savedMinor: 200_000 });
    expect(buildInsights(d)).toContainEqual({ key: "goalLeft", leftMinor: 300_000 });
  });

  it("yaklaşanlar: 14 gün içi, tamamlananlar hariç, geciken yalnızca fatura", async () => {
    const day = 86_400_000;
    const at = (d: number) => new Date(NOW.getTime() + d * day);
    await db.insert(reminders).values([
      {
        userId: "u1",
        kind: "bill",
        title: "Kira",
        dueAt: at(2),
        allDay: true,
        amountMinor: 2_500_000,
      },
      { userId: "u1", kind: "reminder", title: "Toplantı", dueAt: at(1) },
      { userId: "u1", kind: "bill", title: "Gecikmiş fatura", dueAt: at(-2), amountMinor: 30_000 },
      { userId: "u1", kind: "reminder", title: "Eski hatırlatıcı", dueAt: at(-1) },
      { userId: "u1", kind: "reminder", title: "Bitti", dueAt: at(3), completedAt: NOW },
      { userId: "u1", kind: "important_date", title: "Uzak", dueAt: at(20) },
      { userId: "u2", kind: "bill", title: "Başkasının", dueAt: at(1) },
    ]);
    const d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.upcoming.map((u) => [u.title, u.daysUntil, u.overdue])).toEqual([
      ["Gecikmiş fatura", -2, true],
      ["Toplantı", 1, false],
      ["Kira", 2, false],
    ]);
    expect(d.isEmpty).toBe(false);
    expect(buildInsights(d)[0]).toEqual({
      key: "billOverdue",
      title: "Gecikmiş fatura",
      amountMinor: 30_000,
    });
  });

  it("örnek veri dolu bir dashboard üretir ve temizlenebilir", async () => {
    await seedDemoData(db, "u1", NOW);
    let d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.isEmpty).toBe(false);
    expect(d.incomeMinor).toBeGreaterThan(0);
    expect(d.upcoming.length).toBeGreaterThan(0);
    expect(d.recent).toHaveLength(5);
    expect(buildInsights(d).length).toBeGreaterThan(0);

    await clearFinanceData(db, "u1");
    d = await getDashboard(db, { id: "u1", timezone: TZ }, NOW);
    expect(d.isEmpty).toBe(true);
  });
});
