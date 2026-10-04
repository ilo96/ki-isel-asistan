import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { reminders, tasks, transactions, users } from "@/server/db/schema";
import { ensureDefaultCategories } from "./categories";
import { getLifeItems } from "./life-overview";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  LifeError,
  recordBillPayment,
  restoreReminder,
  snoozeReminder,
  undoCompleteReminder,
  updateReminder,
} from "./reminders";
import { createTask, deleteTask, setTaskCompleted } from "./tasks";
import { getTransaction } from "./transactions";

const TZ = "Europe/Istanbul";
const NOW = new Date("2026-10-03T09:00:00Z"); // İstanbul 12:00
const user = { id: "u1", timezone: TZ };
let db: Db;

const reminder = (over: Partial<Parameters<typeof createReminder>[2]> = {}) =>
  createReminder(
    db,
    "u1",
    {
      kind: "reminder",
      title: "Diş randevusu",
      note: "",
      date: "2026-10-03",
      time: "15:00",
      priority: "normal",
      repeat: "none",
      amountMinor: null,
      categoryId: null,
      ...over,
    },
    { timeZone: TZ },
  );

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"]) {
    await db.insert(users).values({ id, name: "Ayşe", email: `${id}@example.com` });
    await ensureDefaultCategories(db, id);
  }
});

beforeEach(async () => {
  await db.delete(reminders);
  await db.delete(tasks);
  await db.delete(transactions);
});

describe("hatırlatıcılar", () => {
  it("saati kullanıcının saat diliminde saklar; tüm gün olanlar 09:00'a yazılır", async () => {
    const { id } = await reminder();
    const allDay = await reminder({
      title: "Annemin doğum günü",
      kind: "important_date",
      time: null,
    });
    const rows = await db.select().from(reminders);
    expect(rows.find((r) => r.id === id)?.dueAt.toISOString()).toBe("2026-10-03T12:00:00.000Z");
    const ad = rows.find((r) => r.id === allDay.id)!;
    expect(ad.allDay).toBe(true);
    expect(ad.dueAt.toISOString()).toBe("2026-10-03T06:00:00.000Z");
  });

  it("tutar ve kategori yalnızca faturada saklanır", async () => {
    const { id } = await reminder({ amountMinor: 5_000 });
    const [row] = await db.select().from(reminders);
    expect(row?.id).toBe(id);
    expect(row?.amountMinor).toBeNull();
  });

  it("tek seferlik hatırlatıcı tamamlanır ve geri alınır", async () => {
    const { id } = await reminder();
    const undo = await completeReminder(db, "u1", id, { timeZone: TZ, now: NOW });
    expect(undo.copyId).toBeNull();
    expect((await getLifeItems(db, user, "done", NOW)).map((i) => i.id)).toEqual([id]);
    await undoCompleteReminder(db, "u1", undo);
    expect((await getLifeItems(db, user, "today", NOW)).map((i) => i.id)).toEqual([id]);
  });

  it("aylık kira tamamlanınca kopyası kalır, kendisi sonraki aya geçer; geri al ikisini de düzeltir", async () => {
    const { id } = await reminder({
      kind: "bill",
      title: "Kira",
      date: "2026-10-05",
      time: null,
      repeat: "monthly",
      amountMinor: 2_500_000,
    });
    const undo = await completeReminder(db, "u1", id, { timeZone: TZ, now: NOW });
    expect(undo.nextDueAt).toBe("2026-11-05T06:00:00.000Z");
    const done = await getLifeItems(db, user, "done", NOW);
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ title: "Kira", repeat: null, date: "2026-10-05" });
    const upcoming = await getLifeItems(db, user, "upcoming", NOW);
    expect(upcoming[0]).toMatchObject({ id, date: "2026-11-05", repeat: "monthly" });

    await undoCompleteReminder(db, "u1", undo);
    expect(await getLifeItems(db, user, "done", NOW)).toHaveLength(0);
    expect((await getLifeItems(db, user, "upcoming", NOW))[0]?.date).toBe("2026-10-05");
  });

  it("gecikmiş tekrarlayan hatırlatıcı tamamlanınca bugünden sonraki ilk tarihe atlar", async () => {
    const { id } = await reminder({ date: "2026-07-01", time: "10:00", repeat: "weekly" });
    const undo = await completeReminder(db, "u1", id, { timeZone: TZ, now: NOW });
    // 1 Temmuz Çarşamba; 3 Ekim'den sonraki ilk Çarşamba 7 Ekim.
    expect(undo.nextDueAt).toBe("2026-10-07T07:00:00.000Z");
  });

  it("fatura ödemesi aynı tutarda gider ekler; kirada Kira kategorisini seçer", async () => {
    const { id } = await reminder({
      kind: "bill",
      title: "Kira",
      amountMinor: 2_500_000,
      time: null,
    });
    const { reminder: row } = await completeReminder(db, "u1", id, { timeZone: TZ, now: NOW });
    const tx = await recordBillPayment(db, "u1", row, { currency: "TRY", today: "2026-10-03" });
    expect(await getTransaction(db, "u1", tx.id)).toMatchObject({
      type: "expense",
      amountMinor: 2_500_000,
      description: "Kira",
      category: { name: "Kira" },
    });
  });

  it("erteleme tarihi taşır; silme ve geri getirme çalışır; başkasının kaydına dokunulmaz", async () => {
    const { id } = await reminder();
    await snoozeReminder(db, "u1", id, new Date("2026-10-04T12:00:00Z"));
    expect((await getLifeItems(db, user, "upcoming", NOW))[0]?.id).toBe(id);
    await deleteReminder(db, "u1", id);
    expect(await getLifeItems(db, user, "upcoming", NOW)).toHaveLength(0);
    await restoreReminder(db, "u1", id);
    await expect(deleteReminder(db, "u2", id)).rejects.toBeInstanceOf(LifeError);
    await expect(
      updateReminder(
        db,
        "u2",
        id,
        {
          kind: "reminder",
          title: "x",
          note: "",
          date: "2026-10-03",
          time: null,
          priority: "low",
          repeat: "none",
          amountMinor: null,
          categoryId: null,
        },
        { timeZone: TZ },
      ),
    ).rejects.toThrow("not_found");
  });
});

describe("görevler ve sekmeler", () => {
  it("Bugün: gecikmişler önce, sonra saat sırası; tarihsiz görevler sonda", async () => {
    const late = await createTask(db, "u1", {
      title: "Vergi beyannamesi",
      note: "",
      dueOn: "2026-10-01",
      priority: "high",
    });
    const inbox = await createTask(db, "u1", {
      title: "Kitap al",
      note: "",
      dueOn: null,
      priority: "low",
    });
    const later = await createTask(db, "u1", {
      title: "Sunum",
      note: "",
      dueOn: "2026-10-10",
      priority: "normal",
    });
    const r = await reminder({ time: "18:00" });
    const today = await getLifeItems(db, user, "today", NOW);
    expect(today.map((i) => i.id)).toEqual([late.id, r.id, inbox.id]);
    expect(today[0]?.overdue).toBe(true);
    expect((await getLifeItems(db, user, "upcoming", NOW)).map((i) => i.id)).toEqual([later.id]);

    await setTaskCompleted(db, "u1", late.id, true, NOW);
    expect((await getLifeItems(db, user, "done", NOW))[0]?.id).toBe(late.id);
    await deleteTask(db, "u1", inbox.id);
    expect((await getLifeItems(db, user, "today", NOW)).map((i) => i.id)).toEqual([r.id]);
  });

  it("geçmişte saati geçen hatırlatıcı gecikmiş sayılır", async () => {
    await reminder({ time: "10:00" });
    const [item] = await getLifeItems(db, user, "today", NOW);
    expect(item?.overdue).toBe(true);
  });
});
