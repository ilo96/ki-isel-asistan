import "server-only";
import { z } from "zod";

/**
 * Sunucu ortam değişkenleri tek yerden, doğrulanarak okunur.
 * DATABASE_URL yoksa geliştirmede gömülü Postgres (PGlite) kullanılır; production'da zorunludur.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_CLIENT_SECRET: z.string().min(1).optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  /** Yoksa asistan çevrimdışı (kural tabanlı) motorla çalışır. */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).default("claude-opus-5-5"),
  AI_FAST_MODEL: z.string().min(1).default("claude-haiku-4-5"),
  /** Web Push (isteğe bağlı): `npx web-push generate-vapid-keys` ile üretilir. */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:destek@example.com"),
  /** Zamanlanmış bildirim işinin (cron) Authorization: Bearer değeri. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Paylaşılan hız sınırı sayacı (birden çok sunucu örneği için). */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Geçersiz ortam değişkenleri: ${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
