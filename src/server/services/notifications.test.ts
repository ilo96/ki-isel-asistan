import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { budgets, notifications, reminders, transactions, users } from "@/server/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/validation/settings";
import { ensureDefaultCategories, listCategories } from "./categories";
import { generateNotifications, inQuietHours, markRead, unreadCount } from "./notifications";
import { createReminder } from "./reminders";
import { updateSettings } from "./settings";

const TZ = "Europe/Istanbul";
const user = { id: "u1", timezone: TZ, currency: "TRY" as const };
// 2026-10-05 pazartesi, İstanbul 10:00
const NOW = new Date("2026-10-05T07:00:00Z");
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  await db.insert(users).values({ id: "u1", name: "Ayşe", email: "u1@example.com" });
  await ensureDefaultCategories(db, "u1");
});

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(reminders);
  await db.delete(transactions);
  await db.delete(budgets);
  await updateSettings(db, "u1", DEFAULT_SETTINGS);
});

const bill = (date: string, title = "Elektrik") =>
  createReminder(
    db,
    "u1",
    { kind: "bill", title, note: "", date, time: null, priority: "normal", repeat: "none", amountMinor: 68_430, categoryId: null },
    { timeZone: TZ },
  );

describe("sessiz saatler", () => {
  it("gece yarısını aşan aralık", () => {
    expect(inQuietHours("23:00", "22:00", "08:00")).toBe(true);
    expect(inQuietHours("07:59", "22:00", "08:00")).toBe(true);
    expect(inQuietHours("08:00", "22:00", "08:00")).toBe(false);
    expect(inQuietHours("13:00", "12:00", "14:00")).toBe(true);
  });
});

describe("bildirim üretimi", () => {
  it("yarınki faturayı bir kez bildirir", async () => {
    await bill("2026-10-06");
    const first = await generateNotifications(db, user, NOW);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: "bill_due", title: "Elektrik yarın ödenecek", body: "Tutar: ₺684,30" });
    expect(await generateNotifications(db, user, NOW)).toHaveLength(0);
  });

  it("sessiz saatte üretmez, sonra üretir", async () => {
    await bill("2026-10-06");
    const night = new Date("2026-10-05T20:00:00Z"); // 23:00
    expect(await generateNotifications(db, user, night)).toHaveLength(0);
    expect(await generateNotifications(db, user, NOW)).toHaveLength(1);
  });

  it("günlük sınırı öncelik sırasıyla uygular", async () => {
    const [market] = (await listCategories(db, "u1")).filter((c) => c.systemKey === "groceries");
    await db.insert(budgets).values({ userId: "u1", categoryId: null, amountMinor: 100_000, startsOn: "2026-10-01" });
    await db.insert(transactions).values({
      userId: "u1",
      type: "expense",
      amountMinor: 120_000,
      currency: "TRY",
      categoryId: market!.id,
      description: "Market",
      occurredOn: "2026-10-02",
    });
    for (const t of ["Elektrik", "Su", "İnternet", "Telefon"]) await bill("2026-10-05", t);
    const created = await generateNotifications(db, user, NOW);
    expect(created).toHaveLength(3);
    expect(created.every((n) => n.kind === "bill_due")).toBe(true);
    // Ertesi gün sınır sıfırlanır; faturalar ödendiyse bütçe uyarısı gelir.
    await db.update(reminders).set({ completedAt: NOW });
    const next = await generateNotifications(db, user, new Date("2026-10-06T07:00:00Z"));
    expect(next.map((n) => n.kind)).toContain("budget_threshold");
  });

  it("kapatılan türü bildirmez; okundu işaretlenir", async () => {
    await bill("2026-10-05");
    await updateSettings(db, "u1", { ...DEFAULT_SETTINGS, notifyBills: false });
    expect(await generateNotifications(db, user, NOW)).toHaveLength(0);
    await updateSettings(db, "u1", DEFAULT_SETTINGS);
    const [n] = await generateNotifications(db, user, NOW);
    expect(await unreadCount(db, "u1")).toBe(1);
    await markRead(db, "u1", n!.id);
    expect(await unreadCount(db, "u1")).toBe(0);
    const [row] = await db.select().from(notifications).where(eq(notifications.id, n!.id));
    expect(row!.readAt).not.toBeNull();
  });
});
