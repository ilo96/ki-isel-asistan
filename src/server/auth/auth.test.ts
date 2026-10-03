import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, type Db } from "@/server/db/client";
import { financialGoals, users } from "@/server/db/schema";
import { completeOnboarding } from "@/server/services/onboarding";
import { createAuth, type Auth } from "./config";

let db: Db;
let auth: Auth;
const resetLinks: string[] = [];

beforeAll(async () => {
  db = await createPgliteDb();
  auth = createAuth({
    db,
    secret: "test-secret-test-secret-test-secret-123",
    baseURL: "http://localhost:3000",
    rateLimit: false,
    sendResetPasswordEmail: async (_to, url) => {
      resetLinks.push(url);
    },
  });
});

async function signUp(email: string, password = "gizli-sifre-1") {
  return auth.api.signUpEmail({ body: { name: "Ayşe", email, password } });
}

describe("kimlik doğrulama", () => {
  it("kayıt olan kullanıcı varsayılan profil alanlarıyla oluşur ve onboarding bekler", async () => {
    const res = await signUp("ayse@example.com");
    expect(res.user.email).toBe("ayse@example.com");
    expect(res.token).toBeTruthy();

    const [row] = await db.select().from(users).where(eq(users.email, "ayse@example.com"));
    expect(row?.currency).toBe("TRY");
    expect(row?.timezone).toBe("Europe/Istanbul");
    expect(row?.onboardedAt).toBeNull();
  });

  it("aynı e-postayla ikinci kayıt reddedilir", async () => {
    await expect(signUp("ayse@example.com")).rejects.toThrow();
  });

  it("doğru şifreyle giriş yapılır, yanlış şifre reddedilir", async () => {
    const ok = await auth.api.signInEmail({
      body: { email: "ayse@example.com", password: "gizli-sifre-1" },
    });
    expect(ok.user.email).toBe("ayse@example.com");
    await expect(
      auth.api.signInEmail({ body: { email: "ayse@example.com", password: "yanlis-sifre" } }),
    ).rejects.toThrow();
  });

  it("kısa şifre kabul edilmez", async () => {
    await expect(signUp("kisa@example.com", "1234567")).rejects.toThrow();
  });

  it("kayıtta profil alanları istemciden değiştirilemez", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          name: "Kötü",
          email: "kotu@example.com",
          password: "gizli-sifre-1",
          onboardedAt: new Date(),
        } as never,
      }),
    ).rejects.toThrow();
  });

  it("şifre sıfırlama bağlantısı üretilir ve yeni şifre çalışır", async () => {
    await auth.api.requestPasswordReset({
      body: { email: "ayse@example.com", redirectTo: "/reset-password" },
    });
    const link = resetLinks.at(-1);
    expect(link).toBeTruthy();
    const token = new URL(link!).pathname.split("/").at(-1)!;
    await auth.api.resetPassword({ body: { token, newPassword: "yeni-sifre-2" } });
    const res = await auth.api.signInEmail({
      body: { email: "ayse@example.com", password: "yeni-sifre-2" },
    });
    expect(res.user.email).toBe("ayse@example.com");
  });
});

describe("onboarding", () => {
  it("profili kaydeder, birikim hedefini oluşturur ve tekrar gönderimde bir şey değiştirmez", async () => {
    const { user } = await signUp("mehmet@example.com");
    const now = new Date("2026-10-15T09:00:00Z");
    const input = {
      name: "Mehmet",
      currency: "EUR" as const,
      monthlyIncomeMinor: 4_500_000,
      savingGoalMinor: 500_000,
    };

    const first = await completeOnboarding(db, user.id, input, now);
    expect(first.alreadyOnboarded).toBe(false);
    const second = await completeOnboarding(db, user.id, { ...input, currency: "USD" }, now);
    expect(second.alreadyOnboarded).toBe(true);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row).toMatchObject({ name: "Mehmet", currency: "EUR", monthlyIncomeMinor: 4_500_000 });
    expect(row?.onboardedAt).toEqual(now);

    const goals = await db.select().from(financialGoals).where(eq(financialGoals.userId, user.id));
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      kind: "saving",
      targetMinor: 500_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      createdVia: "onboarding",
    });
  });

  it("isteğe bağlı alanlar boşsa hedef oluşturmaz", async () => {
    const { user } = await signUp("zeynep@example.com");
    await completeOnboarding(db, user.id, {
      name: "Zeynep",
      currency: "TRY",
      monthlyIncomeMinor: null,
      savingGoalMinor: null,
    });
    const goals = await db.select().from(financialGoals).where(eq(financialGoals.userId, user.id));
    expect(goals).toHaveLength(0);
  });

  it("geçersiz girdi reddedilir", async () => {
    const { user } = await signUp("ali@example.com");
    await expect(
      completeOnboarding(db, user.id, {
        name: " ",
        currency: "TRY",
        monthlyIncomeMinor: -5,
        savingGoalMinor: null,
      }),
    ).rejects.toThrow();
  });
});
