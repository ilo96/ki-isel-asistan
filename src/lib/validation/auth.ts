import { z } from "zod";

/*
 * Giriş, kayıt ve onboarding formlarının şemaları. Aynı şema istemcide (React Hook Form)
 * ve sunucuda (server action) kullanılır. Mesajlar messages/tr.json içindeki anahtarlardır.
 */

export const PASSWORD_MIN = 8;

const email = z.string().trim().toLowerCase().min(1, "required").pipe(z.email("email"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "required"),
});

const password = z.string().min(PASSWORD_MIN, "passwordMin").max(128, "passwordMax");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "required").max(60, "nameMax"),
  email,
  password,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string().min(1, "required") })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "passwordMismatch" });

export const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

/** Tutar alanları kuruş cinsinden; boş bırakılan isteğe bağlı alanlar null gelir. */
const optionalMinor = z
  .number()
  .int()
  .positive("amountPositive")
  .max(1_000_000_000_00, "amountMax")
  .nullable();

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "required").max(60, "nameMax"),
  currency: z.enum(CURRENCIES),
  monthlyIncomeMinor: optionalMinor,
  savingGoalMinor: optionalMinor,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
