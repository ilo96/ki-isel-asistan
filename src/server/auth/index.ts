import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/server/db";
import { sendEmail } from "@/server/email";
import { env, isProduction } from "@/server/env";
import { createAuth, type Auth, type Session } from "./config";

export type { Session } from "./config";

const DEV_SECRET = "dev-only-secret-change-me-dev-only-secret";

const globalForAuth = globalThis as unknown as { authPromise?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  globalForAuth.authPromise ??= build().catch((error: unknown) => {
    globalForAuth.authPromise = undefined;
    throw error;
  });
  return globalForAuth.authPromise;
}

/** Google / Apple düğmeleri yalnızca anahtarları tanımlıysa gösterilir. */
export function enabledSocialProviders() {
  const e = env();
  return {
    google: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    apple: Boolean(e.APPLE_CLIENT_ID && e.APPLE_CLIENT_SECRET),
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
      ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET }
      : undefined;
  const apple =
    e.APPLE_CLIENT_ID && e.APPLE_CLIENT_SECRET
      ? {
          clientId: e.APPLE_CLIENT_ID,
          clientSecret: e.APPLE_CLIENT_SECRET,
          appBundleIdentifier: e.APPLE_APP_BUNDLE_IDENTIFIER,
        }
      : undefined;
  return createAuth({
    db: await getDb(),
    secret: e.BETTER_AUTH_SECRET ?? DEV_SECRET,
    baseURL: e.BETTER_AUTH_URL ?? "http://localhost:3000",
    google,
    apple,
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
