import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/server/env";

/*
 * Dashboard özetinin doğal dile çevrilmesi (plan: Faz 8). Olguları ve kural tabanlı cümleleri
 * kod üretir; hızlı model yalnızca akıcı hale getirir. Yeni bir sayı uydurursa, geç kalırsa
 * ya da anahtar yoksa kural tabanlı metin kullanılır. Sonuç kullanıcı ve olgu başına önbellekte.
 */

const TIMEOUT_MS = 2500;
const TTL_MS = 6 * 60 * 60_000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { text: string; expires: number }>();

/** Metindeki sayılar (₺25.000, %12, 5): modelin çıktısında yeni sayı olmamalı. */
const numbers = (text: string) => new Set(text.match(/\d+(?:[.,]\d+)*/g) ?? []);

export async function phraseSummary(userId: string, ruleText: string): Promise<string> {
  const key = env().ANTHROPIC_API_KEY;
  if (!key || !ruleText) return ruleText;
  const cacheKey = `${userId}:${ruleText}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.text;

  try {
    const client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 });
    const response = await client.messages.create({
      model: env().AI_FAST_MODEL,
      max_tokens: 200,
      system:
        "Kişisel finans uygulamasında kullanıcıya gösterilecek kısa özeti yeniden yazıyorsun. Türkçe, samimi, en fazla iki cümle. Verilen sayıları ve tutarları aynen koru; yeni sayı, tavsiye ya da bilgi ekleme. Yalnızca metni döndür.",
      messages: [{ role: "user", content: ruleText }],
    });
    if (response.stop_reason === "refusal") return ruleText;
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    const allowed = numbers(ruleText);
    const safe = text && [...numbers(text)].every((n) => allowed.has(n));
    const result = safe ? text : ruleText;
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(cacheKey, { text: result, expires: Date.now() + TTL_MS });
    return result;
  } catch {
    return ruleText;
  }
}
