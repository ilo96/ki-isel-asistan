import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { budgets, subscriptions, transactions, users } from "@/server/db/schema";
import { getAchievements } from "./achievements";
import { ensureDefaultCategories, listCategories } from "./categories";
import { seedDemoData } from "./demo-data";
import { getMonthlyRecap } from "./recap";
import {
  createSubscription,
  getSubscriptionOverview,
  setSubscriptionCancelled,
  updateSubscription,
} from "./subscriptions";

const today = "2026-10-04";
let db: Db;
let cat: (key: string) => string;

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"]) {
    await db.insert(users).values({ id, name: "Ali", email: `${id}@example.com` });
    await ensureDefaultCategories(db, id);
  }
  const cats = await listCategories(db, "u1");
  cat = (key) => cats.find((c) => c.systemKey === key)!.id;
});

beforeEach(async () => {
  for (const t of [subscriptions, transactions, budgets]) await db.delete(t);
});

const tx = (
  occurredOn: string,
  lira: number,
  key = "groceries",
  description = "Market",
  type: "income" | "expense" = "expense",
) =>
  db.insert(transactions).values({
    userId: "u1",
    type,
    amountMinor: Math.round(lira * 100),
    currency: "TRY",
    categoryId: cat(key),
    description,
    occurredOn,
  });

const sub = (
  name: string,
  lira: number,
  cycle: "weekly" | "monthly" | "yearly",
  nextChargeOn: string,
) =>
  createSubscription(
    db,
    "u1",
    {
      name,
      amountMinor: lira * 100,
      cycle,
      nextChargeOn,
      categoryId: null,
      remindDaysBefore: 2,
      note: "",
    },
    { currency: "TRY" },
  );

describe("abonelikler", () => {
  it("aylık/yıllık toplam, sıralama, iptal ve sahiplik", async () => {
    const netflix = await sub("Netflix", 230, "monthly", "2026-07-20");
    await sub("iCloud", 1200, "yearly", "2027-01-10");
    await sub("Spotify", 100, "monthly", "2026-10-05");
    let o = await getSubscriptionOverview(db, "u1", today);
    expect(o.active.map((s) => [s.name, s.nextChargeOn, s.daysUntil])).toEqual([
      ["Spotify", "2026-10-05", 1],
      ["Netflix", "2026-10-20", 16],
      ["iCloud", "2027-01-10", 98],
    ]);
    expect(o.monthlyMinor).toBe(23_000 + 10_000 + 10_000);
    expect(o.yearlyMinor).toBe(o.monthlyMinor * 12);

    await setSubscriptionCancelled(db, "u1", netflix.id, true);
    o = await getSubscriptionOverview(db, "u1", today);
    expect(o.active).toHaveLength(2);
    expect(o.cancelled.map((s) => s.name)).toEqual(["Netflix"]);

    await expect(
      updateSubscription(db, "u2", netflix.id, {
        name: "x",
        amountMinor: 1,
        cycle: "monthly",
        nextChargeOn: today,
        categoryId: null,
        remindDaysBefore: 0,
        note: "",
      }),
    ).rejects.toThrow("not_found");
    expect((await getSubscriptionOverview(db, "u2", today)).active).toHaveLength(0);
  });

  it("geçmişten öneri; takip edilen önerilmez", async () => {
    await tx("2026-08-09", 79.99, "entertainment", "YouTube Premium");
    await tx("2026-09-09", 79.99, "entertainment", "YouTube Premium");
    await tx("2026-09-12", 450);
    await tx("2026-08-12", 450);
    let o = await getSubscriptionOverview(db, "u1", today);
    expect(o.suggestions.map((s) => s.name)).toEqual(["YouTube Premium"]);
    expect(o.suggestions[0]).toMatchObject({
      nextChargeOn: "2026-10-09",
      categoryId: cat("entertainment"),
    });
    await sub("YouTube Premium", 80, "monthly", "2026-10-09");
    o = await getSubscriptionOverview(db, "u1", today);
    expect(o.suggestions).toHaveLength(0);
  });
});

describe("aylık özet", () => {
  it("toplamlar, kategoriler, harcamasız gün, seri ve persona", async () => {
    await tx("2026-09-01", 40_000, "salary", "Maaş", "income");
    await tx("2026-09-02", 18_000, "rent", "Kira");
    await tx("2026-09-03", 2_000);
    await tx("2026-09-04", 1_000, "food", "Öğle yemeği");
    await tx("2026-08-10", 10_000, "rent", "Kira");
    const r = await getMonthlyRecap(db, "u1", "2026-09", today);
    expect(r).toMatchObject({
      label: "Eylül 2026",
      partial: false,
      incomeMinor: 4_000_000,
      expenseMinor: 2_100_000,
      transactionCount: 4,
      expenseChange: 110,
      bestStreak: 4,
      noSpendDays: 27,
      persona: { key: "saver" },
      biggest: { description: "Kira", amountMinor: 1_800_000 },
    });
    expect(r.topCategories.map((c) => c.name)).toEqual(["Kira", "Market", "Yemek"]);
    expect(r.topCategories[0]!.share).toBeCloseTo(18 / 21);
    expect(r.busiestWeekday).toBe(3); // 2 Eylül 2026 çarşamba
  });

  it("devam eden ay şimdiye kadar; boş ay", async () => {
    await tx("2026-10-02", 100);
    const r = await getMonthlyRecap(db, "u1", "2026-10", today);
    expect(r).toMatchObject({
      partial: true,
      noSpendDays: 3,
      isEmpty: false,
      persona: { key: "chef" },
    });
    expect((await getMonthlyRecap(db, "u1", "2026-06", today)).isEmpty).toBe(true);
  });
});

describe("rozetler", () => {
  it("seri, son 7 gün ve kazanılanlar", async () => {
    for (const d of ["2026-10-01", "2026-10-02", "2026-10-03"]) await tx(d, 100);
    await db
      .insert(budgets)
      .values({ userId: "u1", categoryId: null, amountMinor: 100_000, startsOn: "2026-09-01" });
    const a = await getAchievements(db, "u1", today);
    expect(a.streak).toEqual({ current: 3, best: 3, activeToday: false });
    expect(a.week.map((w) => w.active)).toEqual([false, false, false, true, true, true, false]);
    const earned = a.badges.filter((b) => b.earned).map((b) => b.key);
    expect(earned).toEqual(
      expect.arrayContaining(["first_step", "streak_3", "budget_set", "budget_kept"]),
    );
    expect(earned).not.toContain("saver");
  });
});

describe("demo verisi", () => {
  it("abonelik, öneri ve seriyi doldurur", async () => {
    await db.insert(users).values({ id: "demo", name: "Demo", email: "demo@example.com" });
    const now = new Date("2026-10-04T09:00:00Z");
    await seedDemoData(db, "demo", now);
    const o = await getSubscriptionOverview(db, "demo", today);
    expect(o.active.map((s) => s.name)).toEqual(["Netflix", "Spotify", "iCloud+"]);
    expect(o.suggestions.map((s) => s.name)).toContain("YouTube Premium");
    expect((await getAchievements(db, "demo", today)).streak.current).toBeGreaterThanOrEqual(5);
  });
});
