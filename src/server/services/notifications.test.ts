import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { budgets, notifications, reminders, subscriptions, transactions, users } from "@/server/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/validation/settings";
import { ensureDefaultCategories, listCategories } from "./categories";
import { generateNotifications, inQuietHours, markRead, unreadCount } from "./notifications";
import { createReminder } from "./reminders";
import { updateSettings } from "./settings";
import { createSubscription } from "./subscriptions";

const TZ = "Europe/Istanbul";
const user = { id: "u1", timezone: TZ, currency: "TRY" as const };
// 2026-10-05 pazartesi, İstanbul 10:00
const NOW = new Date("2026-10-05T07:00:00Z");
// Eski senaryolar yalnızca kendi türlerini sınar; sabah özeti, rozet ve abonelik aşağıda ayrıca.
const BASE = { ...DEFAULT_SETTINGS, notifyDaily: false, notifyAchievements: false, notifySubscriptions: false };
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
  await db.delete(subscriptions);
  await updateSettings(db, "u1", BASE);
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
    await updateSettings(db, "u1", { ...BASE, notifyBills: false });
    expect(await generateNotifications(db, user, NOW)).toHaveLength(0);
    await updateSettings(db, "u1", BASE);
    const [n] = await generateNotifications(db, user, NOW);
    expect(await unreadCount(db, "u1")).toBe(1);
    await markRead(db, "u1", n!.id);
    expect(await unreadCount(db, "u1")).toBe(0);
    const [row] = await db.select().from(notifications).where(eq(notifications.id, n!.id));
    expect(row!.readAt).not.toBeNull();
  });
});

const expense = async (occurredOn: string, amountMinor = 35_000, description = "Market") => {
  const [market] = (await listCategories(db, "u1")).filter((c) => c.systemKey === "groceries");
  await db.insert(transactions).values({
    userId: "u1",
    type: "expense",
    amountMinor,
    currency: "TRY",
    categoryId: market!.id,
    description,
    occurredOn,
  });
};

describe("sabah özeti", () => {
  const morning = new Date("2026-10-05T05:45:00Z"); // 08:45

  it("ödemeler, bütçe ve seriyle tek bildirim; günde bir kez", async () => {
    await updateSettings(db, "u1", { ...BASE, notifyDaily: true, notifyBills: false, notifyWeekly: false });
    await bill("2026-10-05");
    await db.insert(budgets).values({ userId: "u1", categoryId: null, amountMinor: 1_000_000, startsOn: "2026-10-01" });
    await expense("2026-10-03");
    await expense("2026-10-04");
    const [n, ...rest] = await generateNotifications(db, { ...user, name: "Ayşe Yılmaz" }, morning);
    expect(rest).toHaveLength(0);
    expect(n).toMatchObject({ kind: "daily_digest", title: "Günaydın Ayşe ☀️" });
    expect(n!.body).toBe("Bugün 1 ödemen var (₺684,30) · Aylık bütçende ₺9.300 kaldı · 2 günlük serin sürüyor 🔥.");
    expect(await generateNotifications(db, user, new Date("2026-10-05T06:30:00Z"))).toHaveLength(0);
  });

  it("saatinden önce ya da öğleden sonra gönderilmez; kaydı olmayana gönderilmez", async () => {
    await updateSettings(db, "u1", { ...BASE, notifyDaily: true, notifyWeekly: false });
    expect(await generateNotifications(db, user, morning)).toHaveLength(0);
    await expense("2026-10-04");
    expect(await generateNotifications(db, user, new Date("2026-10-05T05:15:00Z"))).toHaveLength(0); // 08:15
    expect(await generateNotifications(db, user, new Date("2026-10-05T11:00:00Z"))).toHaveLength(0); // 14:00
    expect(await generateNotifications(db, user, morning)).toHaveLength(1);
  });
});

describe("abonelik ve seri bildirimleri", () => {
  it("yenilemeden 2 gün önce ve o ödeme için bir kez", async () => {
    await updateSettings(db, "u1", { ...BASE, notifySubscriptions: true });
    await createSubscription(
      db,
      "u1",
      { name: "Netflix", amountMinor: 22_999, cycle: "monthly", nextChargeOn: "2026-08-07", categoryId: null, remindDaysBefore: 2, note: "" },
      { currency: "TRY" },
    );
    const [n] = await generateNotifications(db, user, NOW);
    expect(n).toMatchObject({ kind: "subscription_due", title: "Netflix 2 gün sonra yenileniyor", dedupeKey: expect.stringContaining("2026-10-07") });
    expect(await generateNotifications(db, user, NOW)).toHaveLength(0);
  });

  it("seri eşiği bugün aşılınca kutlar, akşam seri tehlikedeyse hatırlatır", async () => {
    await updateSettings(db, "u1", { ...BASE, notifyAchievements: true, notifyWeekly: false });
    for (const d of ["2026-10-03", "2026-10-04", "2026-10-05"]) await expense(d);
    const [n] = await generateNotifications(db, user, NOW);
    expect(n).toMatchObject({ kind: "achievement", title: "3 günlük seri! 🔥" });
    // Ertesi akşam bugün kayıt yok: seri 3, tehlikede.
    const evening = new Date("2026-10-06T17:30:00Z"); // 20:30
    const [risk] = await generateNotifications(db, user, evening);
    expect(risk).toMatchObject({ kind: "achievement", title: "Serini kaybetme" });
  });
});
