import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { ChatEvent } from "@/lib/assistant/types";
import { createPgliteDb, type Db } from "@/server/db/client";
import { aiActions, budgets, reminders, transactions, users } from "@/server/db/schema";
import { ensureDefaultCategories } from "@/server/services/categories";
import { getConversation, runChat } from "./chat";
import { confirmAction, executeTool, undoAction } from "./executor";
import type { ToolContext } from "./tools";

// API anahtarı yok: çevrimdışı motor çalışır.
delete process.env.ANTHROPIC_API_KEY;

const NOW = new Date("2026-10-03T09:00:00Z");
const user = { id: "u1", currency: "TRY" as const, timezone: "Europe/Istanbul" };
let db: Db;

beforeAll(async () => {
  db = await createPgliteDb();
  for (const id of ["u1", "u2"]) {
    await db.insert(users).values({ id, name: "Ayşe", email: `${id}@example.com` });
    await ensureDefaultCategories(db, id);
  }
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

const ctx = (): ToolContext => ({ db, user, now: NOW, today: "2026-10-03", conversationId: null });

describe("çevrimdışı sohbet", () => {
  it("açık komutla gideri hemen ekler ve geri alınabilir", async () => {
    const r = await chat("Bugün 350 TL yemek harcadım");
    expect(r.reply).toContain("₺350");
    const action = r.events.find((e) => e.type === "action");
    expect(action).toMatchObject({ state: "executed", undoable: true });
    const rows = await db.select().from(transactions).where(eq(transactions.userId, "u1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountMinor: 35000, source: "ai", occurredOn: "2026-10-03" });

    await undoAction(ctx(), (action as { actionId: string }).actionId);
    const [row] = await db.select().from(transactions).where(eq(transactions.id, rows[0]!.id));
    expect(row!.deletedAt).not.toBeNull();
  });

  it("özetteki rakamlar servisten gelir", async () => {
    await chat("Dün markete 1.200 tl verdim");
    const r = await chat("Bu ay ne kadar harcadım?");
    expect(r.reply).toContain("₺1.200");
  });

  it("aylık kira hatırlatıcısı kurar", async () => {
    await chat("Her ayın 5'inde kira hatırlat 25.000 TL");
    const [row] = await db.select().from(reminders).where(eq(reminders.userId, "u1"));
    expect(row).toMatchObject({ kind: "bill", title: "Kira", amountMinor: 2_500_000 });
    expect(row!.recurrence).toBe("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5");
  });

  it("bütçe değişikliği onay bekler, onaylanınca uygulanır", async () => {
    const r = await chat("aylık bütçemi 30.000 TL yap");
    const action = r.events.find((e) => e.type === "action") as Extract<ChatEvent, { type: "action" }>;
    expect(action.state).toBe("proposed");
    expect(await db.select().from(budgets).where(eq(budgets.userId, "u1"))).toHaveLength(0);

    await confirmAction(ctx(), action.actionId!);
    const [b] = await db.select().from(budgets).where(eq(budgets.userId, "u1"));
    expect(b).toMatchObject({ amountMinor: 3_000_000, categoryId: null, startsOn: "2026-10-01" });

    // Geçmiş yüklenince kartın son durumu görünür.
    const conv = await getConversation(db, "u1", r.conversationId, NOW);
    const part = conv!.messages.at(-1)!.parts.find((p) => p.type === "action");
    expect(part).toMatchObject({ state: "executed", undoable: true });
  });

  it("başka kullanıcının konuşmasına yazılamaz", async () => {
    const r = await chat("merhaba");
    await expect(
      runChat({
        db,
        user: { ...user, id: "u2" },
        conversationId: r.conversationId,
        text: "selam",
        emit: () => {},
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("not_found");
  });
});

describe("araç politikası", () => {
  it("geçersiz girdiyi çalıştırmaz", async () => {
    const out = await executeTool(ctx(), "create_transaction", { type: "expense", amount: -5 }, () => {});
    expect(out.isError).toBe(true);
    expect(out.content).toContain("INVALID_INPUT");
  });

  it("çıkarım yapılan yazma onay ister, süresi dolan onay çalışmaz", async () => {
    const events: ChatEvent[] = [];
    const out = await executeTool(
      ctx(),
      "create_task",
      { title: "Kargo gönder", explicit_command: false },
      (e) => events.push(e),
    );
    expect(out.state).toBe("proposed");
    const actionId = (events[0] as { actionId: string }).actionId;
    const late = { ...ctx(), now: new Date(NOW.getTime() + 16 * 60_000) };
    await expect(confirmAction(late, actionId)).rejects.toThrow("expired");
    const [row] = await db.select().from(aiActions).where(eq(aiActions.id, actionId));
    expect(row!.status).toBe("expired");
  });

  it("başka kullanıcının işlemini onaylayamaz", async () => {
    const events: ChatEvent[] = [];
    await executeTool(ctx(), "set_budget", { amount: 500 }, (e) => events.push(e));
    const actionId = (events[0] as { actionId: string }).actionId;
    await expect(confirmAction({ ...ctx(), user: { ...user, id: "u2" } }, actionId)).rejects.toThrow(
      "not_found",
    );
  });
});
