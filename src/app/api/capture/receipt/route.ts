import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import {
  RECEIPT_MEDIA_TYPES,
  readReceipt,
  receiptReadable,
  type ReceiptMediaType,
} from "@/server/ai/receipt";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { draftFromReceipt } from "@/server/services/capture";
import { listCategories } from "@/server/services/categories";

/*
 * Fiş fotoğrafı → işlem taslağı. Fotoğraf istemcide küçültülüp gönderilir (en fazla 4 MB),
 * sunucuda saklanmaz. Kayıt yapılmaz; taslak hızlı ekle formuna döner.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const LIMIT = 10;
const WINDOW_MS = 60 * 60_000;

type ErrorCode =
  | "unauthorized"
  | "not_configured"
  | "invalid"
  | "too_large"
  | "rate_limited"
  | "not_receipt"
  | "unknown";
const fail = (error: ErrorCode, status: number) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return fail("unauthorized", 401);
  if (!receiptReadable()) return fail("not_configured", 503);

  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return fail("invalid", 400);
  if (file.size > MAX_BYTES) return fail("too_large", 413);
  if (!(RECEIPT_MEDIA_TYPES as readonly string[]).includes(file.type)) return fail("invalid", 400);

  // Saatte 10 fiş: maliyet sınırı.
  const limited = await rateLimit(`receipt:${session.user.id}`, LIMIT, WINDOW_MS);
  if (!limited.ok) return fail("rate_limited", 429);

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await readReceipt(
      { data, mediaType: file.type as ReceiptMediaType },
      request.signal,
    );
    if (!result || !result.is_receipt) return fail("not_receipt", 422);
    const categories = await listCategories(await getDb(), session.user.id);
    const today = dayIn(new Date(), session.user.timezone ?? DEFAULT_TIMEZONE);
    return Response.json({ ok: true, draft: draftFromReceipt(result, categories, today) });
  } catch (error) {
    console.error("Fiş okunamadı", (error as Error).name);
    return fail("unknown", 502);
  }
}
