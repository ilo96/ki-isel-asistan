import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/server/db";
import { sendEmail } from "@/server/email";
import { env, isProduction, type ServerEnv } from "@/server/env";
import { createAppleClientSecret } from "./apple-secret";
import { createAuth, type Auth, type Session } from "./config";

export type { Session } from "./config";

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

const globalForAuth = globalThis as unknown as {
  authPromise?: Promise<Auth>;
  authBuiltAt?: number;
};

/** Kendi ürettiğimiz Apple JWT'si süresi dolmadan yenilensin diye auth ara ara yeniden kurulur. */
const REBUILD_AFTER_MS = 1000 * 60 * 60 * 24 * 30;

export function getAuth(): Promise<Auth> {
  if (globalForAuth.authBuiltAt && Date.now() - globalForAuth.authBuiltAt > REBUILD_AFTER_MS) {
    globalForAuth.authPromise = undefined;
  }
  if (!globalForAuth.authPromise) {
    globalForAuth.authBuiltAt = Date.now();
    globalForAuth.authPromise = build().catch((error: unknown) => {
      globalForAuth.authPromise = undefined;
      throw error;
    });
  }
  return globalForAuth.authPromise;
}

/** Apple anahtarı: hazır JWT ya da Team ID + Key ID + .p8 içeriğinden üretilen JWT. */
function appleClientSecret(e: ServerEnv): string | undefined {
  if (e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY && e.APPLE_CLIENT_ID) {
    return createAppleClientSecret({
      teamId: e.APPLE_TEAM_ID,
      keyId: e.APPLE_KEY_ID,
      privateKey: e.APPLE_PRIVATE_KEY,
      clientId: e.APPLE_CLIENT_ID,
    });
  }
  return e.APPLE_CLIENT_SECRET;
}

const appleConfigured = (e: ServerEnv) =>
  Boolean(
    e.APPLE_CLIENT_ID &&
    (e.APPLE_CLIENT_SECRET || (e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY)),
  );

/**
 * Google / Apple düğmeleri yalnızca anahtarları tanımlıysa gösterilir. Kimlikler gizli değildir;
 * mağaza uygulaması yerel giriş penceresini açmak için bunları kullanır.
 */
export function enabledSocialProviders() {
  const e = env();
  const google = Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
  const apple = appleConfigured(e);
  return {
    google,
    apple,
    native: {
      googleWebClientId: google ? e.GOOGLE_CLIENT_ID! : null,
      googleIosClientId: google ? (e.GOOGLE_IOS_CLIENT_ID ?? null) : null,
      appleClientId: apple ? e.APPLE_CLIENT_ID! : null,
    },
  };
}

/** Şifre sıfırlama e-postası gönderilebiliyor mu (geliştirmede bağlantı konsola yazılır). */
export function canResetPassword() {
  return Boolean(env().RESEND_API_KEY) || !isProduction();
}

async function build(): Promise<Auth> {
  const e = env();
  if (isProduction() && !e.BETTER_AUTH_SECRET) {
    throw new Error("Production ortamında BETTER_AUTH_SECRET zorunlu.");
  }
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? {
          clientId: e.GOOGLE_CLIENT_ID,
          clientSecret: e.GOOGLE_CLIENT_SECRET,
          nativeClientIds: e.GOOGLE_IOS_CLIENT_ID ? [e.GOOGLE_IOS_CLIENT_ID] : [],
        }
      : undefined;
  const appleSecret = e.APPLE_CLIENT_ID ? appleClientSecret(e) : undefined;
  const apple =
    e.APPLE_CLIENT_ID && appleSecret
      ? {
          clientId: e.APPLE_CLIENT_ID,
          clientSecret: appleSecret,
          appBundleIdentifier: e.APPLE_APP_BUNDLE_IDENTIFIER,
        }
      : undefined;
  return createAuth({
    db: await getDb(),
    secret: e.BETTER_AUTH_SECRET ?? DEV_SECRET,
    baseURL: e.BETTER_AUTH_URL ?? "http://localhost:3000",
    google,
    apple,
    rateLimit: e.AUTH_RATE_LIMIT === "1",
    sendResetPasswordEmail: canResetPassword()
      ? (to, url) =>
          sendEmail({
            to,
            subject: "Şifreni sıfırla",
            text: `Merhaba,\n\nŞifreni sıfırlamak için bu bağlantıyı aç (1 saat geçerli):\n${url}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
          })
      : undefined,
  });
}

/** İstek başına bir kez okunur (aynı render içinde layout ve sayfa paylaşır). */
export const getSession = cache(async (fresh = false): Promise<Session | null> => {
  // headers() önce çağrılır: sayfayı dinamik yapar, derleme sırasında auth kurulmaz.
  const requestHeaders = await headers();
  const auth = await getAuth();
  return auth.api.getSession({ headers: requestHeaders, query: { disableCookieCache: fresh } });
});

/** Oturum yoksa girişe, onboarding bitmemişse onboarding'e yönlendirir. */
export async function requireUser(options: { onboarded?: boolean } = { onboarded: true }) {
  let session = await getSession();
  if (!session) redirect("/login");
  // Çerez önbelleği onboarding'den önceki hali taşıyor olabilir; karar vermeden önce veritabanına sor.
  if (!session.user.onboardedAt) session = await getSession(true);
  if (!session) redirect("/login");
  if (options.onboarded && !session.user.onboardedAt) redirect("/onboarding");
  return session.user;
}

/** Giriş ve kayıt sayfaları: oturum zaten açıksa doğrudan uygulamaya geçilir. */
export async function redirectIfSignedIn() {
  if (await getSession()) redirect("/home");
}
