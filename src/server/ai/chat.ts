import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type {
  ActionState,
  ChatEvent,
  ChatMessage,
  ConversationSummary,
  MessagePart,
} from "@/lib/assistant/types";
import { dayIn } from "@/lib/dates";
import type { Db } from "@/server/db/client";
import { aiActions, aiConversations, aiMessages } from "@/server/db/schema";
import { env } from "@/server/env";
import type { Engine } from "./engine";
import { executeTool } from "./executor";
import { offlineEngine } from "./offline/engine";
import { getTool, listMemories, type AiUser, type ToolContext } from "./tools";

/*
 * Bir sohbet turu: konuşmayı bulur ya da açar, kullanıcı mesajını kaydeder, motoru
 * çalıştırır (anahtar varsa Claude, yoksa çevrimdışı) ve yanıtı parçalarıyla saklar.
 * Claude hiçbir şey üretmeden hata verirse aynı tur çevrimdışı motorla tamamlanır.
 */

const HISTORY_LIMIT = 12;
const TITLE_MAX = 60;

export class ChatError extends Error {
  constructor(readonly code: "not_found") {
    super(code);
    this.name = "ChatError";
  }
}

export const engineName = () => (env().ANTHROPIC_API_KEY ? "claude" : "offline");

async function loadEngine(): Promise<Engine> {
  if (engineName() === "offline") return offlineEngine;
  return (await import("./claude-engine")).claudeEngine;
}

async function ensureConversation(db: Db, userId: string, id: string | null, text: string) {
  if (id) {
    const [row] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(
          eq(aiConversations.id, id),
          eq(aiConversations.userId, userId),
          isNull(aiConversations.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new ChatError("not_found");
    return row.id;
  }
  const title = text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1).trimEnd()}…` : text;
  const [row] = await db
    .insert(aiConversations)
    .values({ userId, title })
    .returning({ id: aiConversations.id });
  return row!.id;
}

/** Son mesajlar, rolleri sırayla değişecek şekilde (API art arda aynı rolü kabul etmez). */
async function history(db: Db, conversationId: string) {
  const rows = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(HISTORY_LIMIT);
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const row of rows.reverse()) {
    const content = row.content.trim() || "(işlem yapıldı)";
    const last = out.at(-1);
    if (last?.role === row.role) last.content += `\n\n${content}`;
    else out.push({ role: row.role, content });
  }
  while (out[0]?.role === "assistant") out.shift();
  return out;
}

export async function runChat({
  db,
  user,
  conversationId,
  text,
  emit,
  signal,
  now = new Date(),
}: {
  db: Db;
  user: AiUser;
  conversationId: string | null;
  text: string;
  emit: (event: ChatEvent) => void;
  signal: AbortSignal;
  now?: Date;
}) {
  const id = await ensureConversation(db, user.id, conversationId, text);
  const past = await history(db, id);
  await db.insert(aiMessages).values({ conversationId: id, userId: user.id, role: "user", content: text });

  const ctx: ToolContext = { db, user, now, today: dayIn(now, user.timezone), conversationId: id };
  const memories = await listMemories(db, user.id);
  const engine = await loadEngine();
  emit({ type: "start", conversationId: id, engine: engineName() });

  // Yanıtı saklamak için olayları biriktir.
  let content = "";
  const parts: MessagePart[] = [];
  let wrote = false;
  const collect = (event: ChatEvent) => {
    switch (event.type) {
      case "text-delta":
        content += event.text;
        break;
      case "tool-start":
        parts.push({ type: "tool", id: event.id, name: event.name, status: "running", label: event.label });
        break;
      case "tool-end": {
        const part = parts.find((p) => p.type === "tool" && p.id === event.id);
        if (part?.type === "tool") {
          part.status = event.ok ? "done" : "error";
          part.label = event.label;
        }
        break;
      }
      case "action":
        if (event.state === "executed" && event.actionId) wrote = true;
        parts.push({
          type: "action",
          id: event.id,
          actionId: event.actionId,
          state: event.state,
          card: event.card,
          undoable: event.undoable,
        });
        break;
    }
    emit(event);
  };

  const input = {
    ctx,
    text,
    history: past,
    memories,
    call: (name: string, raw: unknown) => executeTool(ctx, name, raw, collect),
    emit: collect,
    signal,
  };
  try {
    await engine(input);
  } catch (error) {
    if (signal.aborted) return { conversationId: id, wrote };
    console.error("Asistan motoru hata verdi", error);
    if (engine !== offlineEngine && !content && parts.length === 0) {
      await offlineEngine(input);
    } else {
      collect({ type: "text-delta", text: content ? "\n\nBağlantı kesildi, yanıtı tamamlayamadım." : "Şu an yanıt veremiyorum, biraz sonra tekrar dener misin?" });
    }
  }

  const [saved] = await db
    .insert(aiMessages)
    .values({ conversationId: id, userId: user.id, role: "assistant", content, parts })
    .returning({ id: aiMessages.id });
  await db
    .update(aiConversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(aiConversations.id, id));
  emit({ type: "done", messageId: saved!.id });
  return { conversationId: id, wrote };
}

/* -------------------------------------------------------- Geçmiş ve listeler */

export async function listConversations(db: Db, userId: string, limit = 30): Promise<ConversationSummary[]> {
  const rows = await db
    .select({ id: aiConversations.id, title: aiConversations.title, lastMessageAt: aiConversations.lastMessageAt })
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), isNull(aiConversations.deletedAt)))
    .orderBy(desc(aiConversations.lastMessageAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, lastMessageAt: r.lastMessageAt.toISOString() }));
}

/** Konuşmanın mesajları; kartların durumu ai_actions'tan güncellenir (sonradan onaylanmış olabilir). */
export async function getConversation(db: Db, userId: string, id: string, now = new Date()) {
  const [conv] = await db
    .select({ id: aiConversations.id, title: aiConversations.title })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId), isNull(aiConversations.deletedAt)))
    .limit(1);
  if (!conv) return null;
  const rows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, id))
    .orderBy(asc(aiMessages.createdAt));

  const actionIds = rows.flatMap((r) =>
    (r.parts as MessagePart[]).flatMap((p) => (p.type === "action" && p.actionId ? [p.actionId] : [])),
  );
  const actions = actionIds.length
    ? await db
        .select({ id: aiActions.id, status: aiActions.status, expiresAt: aiActions.expiresAt, tool: aiActions.tool })
        .from(aiActions)
        .where(and(eq(aiActions.userId, userId), inArray(aiActions.id, actionIds)))
    : [];
  const byId = new Map(actions.map((a) => [a.id, a]));

  const messages: ChatMessage[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    parts: (r.parts as MessagePart[]).map((p) => {
      if (p.type !== "action" || !p.actionId) return p;
      const a = byId.get(p.actionId);
      if (!a) return p;
      let state: ActionState = a.status;
      if (state === "proposed" && a.expiresAt && a.expiresAt < now) state = "expired";
      return { ...p, state, undoable: state === "executed" && !!getTool(a.tool)?.undo };
    }),
  }));
  return { ...conv, messages };
}

export async function deleteConversation(db: Db, userId: string, id: string) {
  await db
    .update(aiConversations)
    .set({ deletedAt: new Date() })
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)));
}
