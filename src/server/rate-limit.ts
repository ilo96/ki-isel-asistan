import "server-only";
import { env } from "@/server/env";

/*
 * Sabit pencereli hız sınırı. UPSTASH_REDIS_REST_URL/TOKEN tanımlıysa sayaç Upstash'te
 * tutulur (birden çok sunucu örneği aynı sayacı görür); yoksa bellekte. Upstash'e
 * ulaşılamazsa istek engellenmez, bellek sayacına düşülür.
 */

type Result = { ok: boolean; retryAfterMs: number };
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function memory(key: string, limit: number, windowMs: number, now: number): Result {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count += 1;
  return bucket.count > limit
    ? { ok: false, retryAfterMs: bucket.resetAt - now }
    : { ok: true, retryAfterMs: 0 };
}

async function upstash(url: string, token: string, key: string, limit: number, windowMs: number, now: number) {
  const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`;
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", windowKey],
      ["PEXPIRE", windowKey, String(windowMs)],
    ]),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Upstash ${response.status}`);
  const [incr] = (await response.json()) as [{ result: number }];
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  return incr.result > limit ? { ok: false, retryAfterMs: resetAt - now } : { ok: true, retryAfterMs: 0 };
}

export async function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<Result> {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env();
  if (url && token) {
    try {
      return await upstash(url, token, key, limit, windowMs, now);
    } catch (error) {
      console.error("Upstash hız sınırı okunamadı; bellek sayacı kullanılıyor", error);
    }
  }
  return memory(key, limit, windowMs, now);
}
