"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionCard, ConversationSummary } from "@/lib/assistant/types";
import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { deleteConversation, listConversations } from "@/server/ai/chat";
import { ActionError, confirmAction, rejectAction, undoAction } from "@/server/ai/executor";
import type { ToolContext } from "@/server/ai/tools";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";

/*
 * Asistan kartlarının düğmeleri: onayla, vazgeç, geri al. Hepsi işlemin sahibini
 * oturumdan doğrular; işlemi yeniden çalıştırmak yerine kayıtlı girdiyi kullanır.
 */

export type AssistantActionError = "unauthorized" | "invalid" | "unknown" | ActionError["code"];
type Result<T> = { ok: true; data: T } | { ok: false; error: AssistantActionError };

const id = z.uuid();

async function withContext<T>(fn: (ctx: ToolContext) => Promise<T>): Promise<Result<T>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  const timezone = session.user.timezone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const ctx: ToolContext = {
    db: await getDb(),
    user: {
      id: session.user.id,
      currency: (session.user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
      timezone,
    },
    now,
    today: dayIn(now, timezone),
    conversationId: null,
  };
  try {
    return { ok: true, data: await fn(ctx) };
  } catch (error) {
    if (error instanceof ActionError) return { ok: false, error: error.code };
    console.error("Asistan işlemi başarısız", error);
    return { ok: false, error: "unknown" };
  }
}

export async function confirmAssistantAction(
  actionId: string,
): Promise<Result<{ card: ActionCard | null; undoable: boolean }>> {
  if (!id.safeParse(actionId).success) return { ok: false, error: "invalid" };
  const result = await withContext((ctx) => confirmAction(ctx, actionId));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function rejectAssistantAction(actionId: string): Promise<Result<null>> {
  if (!id.safeParse(actionId).success) return { ok: false, error: "invalid" };
  return withContext(async (ctx) => {
    await rejectAction(ctx, actionId);
    return null;
  });
}

export async function undoAssistantAction(actionId: string): Promise<Result<null>> {
  if (!id.safeParse(actionId).success) return { ok: false, error: "invalid" };
  const result = await withContext(async (ctx) => {
    await undoAction(ctx, actionId);
    return null;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function listConversationsAction(): Promise<Result<ConversationSummary[]>> {
  return withContext((ctx) => listConversations(ctx.db, ctx.user.id));
}

export async function deleteConversationAction(conversationId: string): Promise<Result<null>> {
  if (!id.safeParse(conversationId).success) return { ok: false, error: "invalid" };
  const result = await withContext(async (ctx) => {
    await deleteConversation(ctx.db, ctx.user.id, conversationId);
    return null;
  });
  if (result.ok) revalidatePath("/assistant", "layout");
  return result;
}
