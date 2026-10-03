import { and, eq } from "drizzle-orm";
import type { ActionCard, ActionState, ChatEvent } from "@/lib/assistant/types";
import { aiActions } from "@/server/db/schema";
import { FinanceError } from "@/server/services/categories";
import { LifeError } from "@/server/services/reminders";
import { getTool, ToolError, type ToolContext, type ToolDef } from "./tools";

/*
 * Araç çağrılarını politika ile çalıştırır (plan: Tool kullanım politikası):
 * okuma hemen; açık komutla verilen yazma hemen ve geri alınabilir; çıkarım yapılan yazma,
 * silme ve bütçe değişikliği önce onay kartı olarak kullanıcıya gelir. Onay 15 dakika geçerli.
 */

export const CONFIRM_TTL_MS = 15 * 60_000;

export type ToolCallOutcome = {
  /** tool_result içeriği (JSON). */
  content: string;
  isError: boolean;
  /** Çevrimdışı motorun cümle kurması için ayrıştırılmış hali. */
  data: Record<string, unknown> | null;
  state: "read" | ActionState;
};

export type Decision = "run" | "confirm";

export function decide(tool: ToolDef, input: Record<string, unknown>): Decision {
  if (tool.kind === "read") return "run";
  if (tool.kind === "sensitive") return "confirm";
  return input.explicit_command === true ? "run" : "confirm";
}

function errorCode(error: unknown) {
  if (error instanceof ToolError || error instanceof FinanceError || error instanceof LifeError) {
    return error.code;
  }
  return null;
}

let seq = 0;
const partId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function executeTool(
  ctx: ToolContext,
  name: string,
  rawInput: unknown,
  emit: (event: ChatEvent) => void,
): Promise<ToolCallOutcome> {
  const fail = (code: string, extra?: Record<string, unknown>): ToolCallOutcome => ({
    content: JSON.stringify({ error: code, ...extra }),
    isError: true,
    data: null,
    state: "failed",
  });

  const tool = getTool(name);
  if (!tool) return fail("unknown_tool");
  // Akışla gelen girdi kesik olabilir; çalıştırmadan önce şemayla doğrula.
  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return fail("INVALID_INPUT", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  const input = parsed.data as Record<string, unknown>;
  const id = partId();

  try {
    if (decide(tool, input) === "confirm") {
      const card = await tool.preview!(ctx, input);
      const [row] = await ctx.db
        .insert(aiActions)
        .values({
          userId: ctx.user.id,
          conversationId: ctx.conversationId,
          tool: tool.name,
          input,
          status: "proposed",
          expiresAt: new Date(ctx.now.getTime() + CONFIRM_TTL_MS),
        })
        .returning({ id: aiActions.id });
      emit({ type: "action", id, actionId: row!.id, state: "proposed", card, undoable: false });
      const data = { status: "awaiting_user_confirmation", note: "The user sees a confirm card." };
      return { content: JSON.stringify(data), isError: false, data, state: "proposed" };
    }

    // Okumalar küçük bir durum çipi gösterir; yazmaların sonucu kartta görünür.
    const chip = tool.kind === "read";
    if (chip) emit({ type: "tool-start", id, name: tool.name, label: tool.label });
    const result = await tool.run(ctx, input);
    if (chip) emit({ type: "tool-end", id, ok: true, label: tool.doneLabel ?? tool.label });

    if (tool.kind === "read") {
      if (result.card) {
        emit({ type: "action", id: `${id}c`, actionId: null, state: "executed", card: result.card, undoable: false });
      }
      if (result.navigate) emit({ type: "navigate", href: result.navigate });
      return { content: JSON.stringify(result.data), isError: false, data: result.data, state: "read" };
    }

    const [row] = await ctx.db
      .insert(aiActions)
      .values({
        userId: ctx.user.id,
        conversationId: ctx.conversationId,
        tool: tool.name,
        input,
        status: "executed",
        result: { card: result.card ?? null, data: result.data },
        undo: result.undo ?? null,
        executedAt: ctx.now,
      })
      .returning({ id: aiActions.id });
    if (result.card) {
      emit({
        type: "action",
        id: `${id}c`,
        actionId: row!.id,
        state: "executed",
        card: result.card,
        undoable: !!tool.undo && result.undo !== undefined,
      });
    }
    return { content: JSON.stringify(result.data), isError: false, data: result.data, state: "executed" };
  } catch (error) {
    if (tool.kind === "read") emit({ type: "tool-end", id, ok: false, label: tool.label });
    const code = errorCode(error);
    if (!code) console.error(`Araç hatası: ${name}`, error);
    return fail(code ?? "tool_failed");
  }
}

/* --------------------------------------------- Onay, ret ve geri al (UI'dan) */

export class ActionError extends Error {
  constructor(readonly code: "not_found" | "expired" | "not_undoable" | "failed") {
    super(code);
    this.name = "ActionError";
  }
}

async function load(ctx: ToolContext, actionId: string) {
  const [row] = await ctx.db
    .select()
    .from(aiActions)
    .where(and(eq(aiActions.id, actionId), eq(aiActions.userId, ctx.user.id)))
    .limit(1);
  if (!row) throw new ActionError("not_found");
  const tool = getTool(row.tool);
  if (!tool) throw new ActionError("not_found");
  return { row, tool };
}

export async function confirmAction(
  ctx: ToolContext,
  actionId: string,
): Promise<{ card: ActionCard | null; undoable: boolean }> {
  const { row, tool } = await load(ctx, actionId);
  if (row.status !== "proposed") throw new ActionError("not_found");
  if (row.expiresAt && row.expiresAt < ctx.now) {
    await ctx.db.update(aiActions).set({ status: "expired" }).where(eq(aiActions.id, row.id));
    throw new ActionError("expired");
  }
  // Önerilen girdi saklanırken doğrulandı; şema değişmiş olabileceği için yine doğrula.
  const input = tool.schema.parse(row.input) as Record<string, unknown>;
  let result;
  try {
    result = await tool.run(ctx, input);
  } catch (error) {
    if (!errorCode(error)) console.error(`Onaylanan işlem başarısız: ${row.tool}`, error);
    throw new ActionError("failed");
  }
  await ctx.db
    .update(aiActions)
    .set({
      status: "executed",
      result: { card: result.card ?? null, data: result.data },
      undo: result.undo ?? null,
      executedAt: ctx.now,
    })
    .where(eq(aiActions.id, row.id));
  return { card: result.card ?? null, undoable: !!tool.undo && result.undo !== undefined };
}

export async function rejectAction(ctx: ToolContext, actionId: string) {
  const { row } = await load(ctx, actionId);
  if (row.status !== "proposed") throw new ActionError("not_found");
  await ctx.db.update(aiActions).set({ status: "rejected" }).where(eq(aiActions.id, row.id));
}

export async function undoAction(ctx: ToolContext, actionId: string) {
  const { row, tool } = await load(ctx, actionId);
  if (row.status !== "executed" || !tool.undo || row.undo === null) {
    throw new ActionError("not_undoable");
  }
  try {
    await tool.undo(ctx, row.undo);
  } catch (error) {
    if (!errorCode(error)) console.error(`Geri alma başarısız: ${row.tool}`, error);
    throw new ActionError("failed");
  }
  await ctx.db.update(aiActions).set({ status: "undone" }).where(eq(aiActions.id, row.id));
}
