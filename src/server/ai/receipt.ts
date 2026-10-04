import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/server/env";
import { CATEGORY_KEYWORDS } from "./keywords";

/*
 * Fiş okuma: fotoğraf Claude'a (görsel girdi) gönderilir, yanıt zorunlu bir araç çağrısıyla
 * yapılandırılmış gelir ve Zod ile doğrulanır. Fotoğraf saklanmaz; yalnızca bu istekte kullanılır.
 * API anahtarı yoksa çağrılmaz (arayüz kullanıcıya nedenini söyler).
 */

export const receiptReadable = () => !!env().ANTHROPIC_API_KEY;

export const RECEIPT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number];

const EXPENSE_KEYS = Object.keys(CATEGORY_KEYWORDS).filter(
  (k) => k !== "salary" && k !== "other_income",
);

const resultSchema = z.object({
  is_receipt: z.boolean(),
  merchant: z.string().max(80).nullable(),
  /** Ödenen genel toplam, ana birimde (ör. 1234.5). */
  total: z.number().nonnegative().nullable(),
  currency: z.string().max(3).nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  category: z.string().nullable(),
});

export type ReceiptResult = z.infer<typeof resultSchema>;

const TOOL: Anthropic.Tool = {
  name: "record_receipt",
  description: "Fişten okunan bilgileri kaydeder.",
  input_schema: {
    type: "object",
    properties: {
      is_receipt: {
        type: "boolean",
        description: "Görsel bir fiş, fatura ya da ödeme dekontu mu?",
      },
      merchant: {
        type: ["string", "null"],
        description: "İşletme adı, kısa ve okunur (ör. 'Migros').",
      },
      total: {
        type: ["number", "null"],
        description:
          "Ödenen GENEL TOPLAM (KDV dahil, 'TOPLAM' satırı), ana para biriminde. Ara toplam ya da KDV değil.",
      },
      currency: { type: ["string", "null"], description: "ISO para birimi (TRY, USD, EUR...)." },
      date: { type: ["string", "null"], description: "Fiş tarihi YYYY-MM-DD; okunamıyorsa null." },
      category: { type: ["string", "null"], enum: [...EXPENSE_KEYS, "other_expense", null] },
    },
    required: ["is_receipt", "merchant", "total", "currency", "date", "category"],
  },
};

let client: Anthropic | undefined;

export async function readReceipt(
  image: { data: string; mediaType: ReceiptMediaType },
  signal?: AbortSignal,
) {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  const message = await client.messages.create(
    {
      model: env().AI_FAST_MODEL,
      max_tokens: 512,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: image.mediaType, data: image.data },
            },
            {
              type: "text",
              text: "Bu bir Türk alışveriş fişi olabilir. Genel toplamı, işletme adını, tarihi ve en uygun gider kategorisini oku. Emin olmadığın alanı null bırak.",
            },
          ],
        },
      ],
    },
    { signal },
  );
  const call = message.content.find((b) => b.type === "tool_use");
  const parsed = resultSchema.safeParse(call?.type === "tool_use" ? call.input : null);
  return parsed.success ? parsed.data : null;
}
