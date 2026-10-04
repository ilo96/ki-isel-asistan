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
  /** iOS uygulamasındaki yerel Google girişi için "iOS" türündeki OAuth istemci kimliği. */
  GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional(),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  /** Ya hazır JWT (6 ayda bir yenilenmeli) ya da aşağıdaki üçlü verilir; üçlü verilirse JWT kendiliğinden üretilir. */
  APPLE_CLIENT_SECRET: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  APPLE_PRIVATE_KEY: z.string().min(1).optional(),
  /** iOS uygulamasının paket kimliği (capacitor.config.ts appId); yerel Apple girişi ve APNs kullanır. */
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().min(1).default("com.vantrelcode.app"),
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
  /** Mağaza uygulaması bildirimleri. Android: Firebase hizmet hesabı JSON'u (tek satır). */
  FCM_SERVICE_ACCOUNT: z.string().min(1).optional(),
  /** iOS: Apple Push Notifications anahtarı (.p8 içeriği) ve kimliği; Team ID APPLE_TEAM_ID'den okunur. */
  APNS_KEY_ID: z.string().min(1).optional(),
  APNS_PRIVATE_KEY: z.string().min(1).optional(),
  /** "sandbox": Xcode'dan kurulan geliştirme derlemeleri; mağaza ve TestFlight için "production". */
  APNS_ENV: z.enum(["production", "sandbox"]).default("production"),
  /** Zamanlanmış bildirim işinin (cron) Authorization: Bearer değeri. */
  CRON_SECRET: z.string().min(16).optional(),
  /** Paylaşılan hız sınırı sayacı (birden çok sunucu örneği için). */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  /** "1": production derlemesinde de gömülü Postgres kullan (yalnızca önizleme ve E2E için). */
  LOCAL_DB: z.enum(["0", "1"]).default("0"),
  /** "1": production derlemesinde demo verisi düğmesini göster (önizleme sunucusu için). */
  DEMO_MODE: z.enum(["0", "1"]).default("0"),
  /** "0": giriş/kayıt hız sınırını kapat (yalnızca uçtan uca testlerde). */
  AUTH_RATE_LIMIT: z.enum(["0", "1"]).default("1"),
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

/** Demo verisi düğmesi: geliştirmede her zaman, production'da yalnızca DEMO_MODE=1 ile. */
export const demoEnabled = () => !isProduction() || env().DEMO_MODE === "1";
