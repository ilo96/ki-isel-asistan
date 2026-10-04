import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APP_NAME } from "@/config/brand";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { PASSWORD_MIN } from "@/lib/validation/auth";

/*
 * Better Auth yapılandırması. server-only içermez; testler bunu bellekteki PGlite ile kurar.
 * Uygulama kodu `@/server/auth` üzerinden kullanır.
 */

export type AuthDeps = {
  db: Db;
  secret: string;
  baseURL: string;
  /** nativeClientIds: mağaza uygulamasındaki yerel girişin kimlik belirteci bunlardan biri için de kabul edilir. */
  google?: { clientId: string; clientSecret: string; nativeClientIds?: string[] };
  apple?: { clientId: string; clientSecret: string; appBundleIdentifier?: string };
  sendResetPasswordEmail?: (to: string, url: string) => Promise<void>;
  /** Testlerde istek sınırı kapatılır. */
  rateLimit?: boolean;
};

export function createAuth(deps: AuthDeps) {
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  if (deps.google) {
    const { nativeClientIds = [], ...google } = deps.google;
    // İlk kimlik web akışında kullanılır; diğerleri yalnızca yerel girişin belirtecini doğrular.
    socialProviders.google = { ...google, clientId: [google.clientId, ...nativeClientIds], prompt: "select_account" };
  }
  if (deps.apple) {
    // Web akışında belirteç Services ID için, iOS'taki yerel girişte uygulamanın Bundle ID'si için üretilir.
    const audience = [deps.apple.clientId, ...(deps.apple.appBundleIdentifier ? [deps.apple.appBundleIdentifier] : [])];
    socialProviders.apple = { ...deps.apple, audience };
  }

  return betterAuth({
    appName: APP_NAME,
    secret: deps.secret,
    baseURL: deps.baseURL,
    trustedOrigins: deps.apple ? [deps.baseURL, "https://appleid.apple.com"] : [deps.baseURL],
    database: drizzleAdapter(deps.db, { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: 128,
      autoSignIn: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: deps.sendResetPasswordEmail
        ? async ({ user, url }) => {
            await deps.sendResetPasswordEmail?.(user.email, url);
          }
        : undefined,
    },
    socialProviders,
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple"] } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Her istekte veritabanına gitmemek için oturum 5 dk imzalı çerezde önbelleklenir.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: {
      additionalFields: {
        locale: { type: "string", required: false, defaultValue: "tr-TR", input: false },
        currency: { type: "string", required: false, defaultValue: "TRY", input: false },
        timezone: {
          type: "string",
          required: false,
          defaultValue: "Europe/Istanbul",
          input: false,
        },
        monthlyIncomeMinor: { type: "number", required: false, input: false },
        onboardedAt: { type: "date", required: false, input: false },
      },
    },
    rateLimit: {
      enabled: deps.rateLimit ?? true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
