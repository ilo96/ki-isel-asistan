import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ChatEvent } from "@/lib/assistant/types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { ChatError, runChat } from "@/server/ai/chat";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";

/*
 * Asistan sohbeti: POST ile mesaj alır, yanıtı Server-Sent Events olarak akıtır
 * (plan: start, text-delta, tool-start/end, action, suggestions, done/error).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.uuid().nullable().default(null),
  text: z.string().trim().min(1).max(1000),
});

/** Plan: kullanıcı başına dakikada 10 mesaj; ayrıca günlük kota (maliyet sınırı). */
const LIMIT = 10;
const WINDOW_MS = 60_000;
const DAILY_LIMIT = 200;
const DAY_MS = 24 * 60 * 60_000;

const sse = (event: ChatEvent) => `data: ${JSON.stringify(event)}\n\n`;

function single(event: ChatEvent, status: number) {
  return new Response(sse(event), { status, headers: { "Content-Type": "text/event-stream" } });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return single({ type: "error", code: "unauthorized" }, 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return single({ type: "error", code: "invalid" }, 400);

  const [minute, day] = await Promise.all([
    rateLimit(`chat:${session.user.id}`, LIMIT, WINDOW_MS),
    rateLimit(`chat-day:${session.user.id}`, DAILY_LIMIT, DAY_MS),
  ]);
  if (!minute.ok || !day.ok) return single({ type: "error", code: "rate_limited" }, 429);

  const user = {
    id: session.user.id,
    currency: (session.user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
    timezone: session.user.timezone ?? DEFAULT_TIMEZONE,
  };
  const db = await getDb();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: ChatEvent) => {
        if (open) controller.enqueue(encoder.encode(sse(event)));
      };
      try {
        const { wrote } = await runChat({
          db,
          user,
          conversationId: parsed.data.conversationId,
          text: parsed.data.text,
          emit,
          signal: request.signal,
        });
        // Asistan veri değiştirdiyse ekranlar yeni veriyi göstersin.
        if (wrote) revalidatePath("/", "layout");
      } catch (error) {
        if (!(error instanceof ChatError)) console.error("Sohbet akışı başarısız", error);
        emit({ type: "error", code: error instanceof ChatError ? "invalid" : "unknown" });
      } finally {
        open = false;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
