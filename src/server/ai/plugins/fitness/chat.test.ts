import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { ChatEvent } from "@/lib/assistant/types";
import { createPgliteDb, type Db } from "@/server/db/client";
import { fitnessGoals, users, weightRecords, workouts } from "@/server/db/schema";
import { ensureDefaultCategories } from "@/server/services/categories";
import { setModuleState } from "@/server/services/modules";
import { runChat } from "../../chat";
import { confirmAction } from "../../executor";

// API anahtarı yok: çevrimdışı motor ve eklentinin Türkçe ayrıştırıcısı çalışır.
delete process.env.ANTHROPIC_API_KEY;

const NOW = new Date("2026-10-03T09:00:00Z");
const user = { id: "f1", currency: "TRY" as const, timezone: "Europe/Istanbul" };
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  await db.insert(users).values({ id: "f1", name: "Deniz", email: "f1@example.com" });
  await ensureDefaultCategories(db, "f1");
});

async function chat(text: string, conversationId: string | null = null) {
  const events: ChatEvent[] = [];
  const result = await runChat({
    db,
    user,
    conversationId,
    text,
    emit: (e) => events.push(e),
    signal: new AbortController().signal,
    now: NOW,
  });
  const reply = events.flatMap((e) => (e.type === "text-delta" ? [e.text] : [])).join("");
  return { ...result, events, reply };
}

describe("Spor & Sağlık sohbeti", () => {
  it("VKİ sorulunca eksik bilgiyi ister", async () => {
    const r = await chat("VKİ'm kaç?");
    expect(r.reply).toContain("boyunu ve kilonu");
  });

  it("boy ve kilo kaydedilir, VKİ bilgilendirici dille anlatılır", async () => {
    const r = await chat("Boyum 180, kilom 80");
    expect(r.reply).toContain("VKİ'n 24,7");
    expect(r.reply).toContain("normal kategorisine");
    expect(r.reply).toContain("tek başına");
    expect(r.events.find((e) => e.type === "action")).toMatchObject({
      state: "executed",
      undoable: true,
    });
    const again = await chat("VKİ'm kaç?");
    expect(again.reply).toContain("24,7");
  });

  it("geçersiz kilo için açık mesaj", async () => {
    const r = await chat("kilom 0");
    expect(r.reply).toContain("Lütfen geçerli bir kilo değeri girin.");
  });

  it("aktivite kaydı ve eksik süre sorusu", async () => {
    const r = await chat("Bugün 30 dakika koştum");
    expect(r.reply).toContain("Koşu");
    expect(r.reply).toContain("30 dk");
    const rows = await db.select().from(workouts).where(eq(workouts.userId, "f1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "running",
      durationMin: 30,
      createdVia: "ai",
      caloriesEstimated: true,
    });

    const ask = await chat("Bugünkü sporumu kaydet");
    expect(ask.reply).toContain("Hangi aktiviteyi");
    const type = await chat("yüzdüm", ask.conversationId);
    expect(type.reply).toContain("Ne kadar sürdü");
    const done = await chat("45 dakika", ask.conversationId);
    expect(done.reply).toContain("Yüzme");
    expect(await db.select().from(workouts).where(eq(workouts.userId, "f1"))).toHaveLength(2);

    await chat("Bugün 1 saat fitness yaptım");
    const week = await chat("Bu hafta kaç gün spor yaptım?");
    expect(week.reply).toContain("1 gün");
    expect(week.reply).toContain("3 aktivite");
  });

  it("kilo değişimi soruları", async () => {
    await db
      .insert(weightRecords)
      .values({ userId: "f1", weightG: 82_400, measuredOn: "2026-09-03" });
    const r = await chat("Geçen aya göre kilom nasıl değişti?");
    expect(r.reply).toContain("Son 30 günde 2,4 kg azalma var");
    const m = await chat("Bu ay kaç kilo verdim?");
    expect(m.reply).toContain("80 kg");
  });

  it("hedef onay kartıyla kurulur ve güvenlik notu taşır", async () => {
    const r = await chat("82 kilodan 75 kiloya düşmek istiyorum");
    const card = r.events.find((e) => e.type === "action") as Extract<
      ChatEvent,
      { type: "action" }
    >;
    expect(card.state).toBe("proposed");
    expect(r.reply).toContain("sağlık uzmanına");
    expect(await db.select().from(fitnessGoals).where(eq(fitnessGoals.userId, "f1"))).toHaveLength(
      0,
    );
    await confirmAction(
      { db, user, now: NOW, today: "2026-10-03", conversationId: null },
      card.actionId!,
    );
    const [goal] = await db.select().from(fitnessGoals).where(eq(fitnessGoals.userId, "f1"));
    expect(goal).toMatchObject({ startValue: 82_000, targetValue: 75_000, status: "active" });
    const p = await chat("Hedefime ne kadar kaldı?");
    expect(p.reply).toContain("5 kg kaldı");
  });

  it("finans cümleleri eklentiye takılmaz", async () => {
    const r = await chat("Spor salonu üyeliği için 900 TL ödedim");
    expect(r.reply).toContain("₺900");
  });

  it("eklenti kapalıysa nasıl açılacağını söyler", async () => {
    await setModuleState(db, "f1", "fitness", { enabled: false });
    const r = await chat("Bugün 20 dakika yürüdüm");
    expect(r.reply).toContain("kapalı");
    await setModuleState(db, "f1", "fitness", { enabled: true });
  });
});
