import { z } from "zod";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/finance/categories";

/*
 * İşlem ve kategori şemaları. Aynı şema hızlı ekle formunda, server action'da ve
 * ileride asistanın tool'larında kullanılır. Mesajlar validation çevirisindeki anahtarlardır.
 */

export const TRANSACTION_TYPES = ["income", "expense"] as const;

export const MAX_AMOUNT_MINOR = 1_000_000_000_00;

export const transactionInputSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  amountMinor: z
    .number("amount")
    .int("amount")
    .positive("amountPositive")
    .max(MAX_AMOUNT_MINOR, "amountMax"),
  categoryId: z.uuid("categoryRequired"),
  /** Boş bırakılırsa kategori adı kullanılır. */
  description: z.string().trim().max(120, "descriptionMax"),
  note: z
    .string()
    .trim()
    .max(500, "noteMax")
    .transform((v) => (v === "" ? null : v)),
  occurredOn: z.iso.date("date"),
});

export type TransactionInput = z.input<typeof transactionInputSchema>;
export type ParsedTransactionInput = z.output<typeof transactionInputSchema>;

export const categoryInputSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  name: z.string().trim().min(1, "required").max(40, "categoryNameMax"),
  icon: z.enum(CATEGORY_ICONS),
  colorToken: z.enum(CATEGORY_COLORS),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** İşlem listesi filtreleri; URL'den gelir, geçersiz değerler yok sayılır. */
export const transactionFilterSchema = z.object({
  type: z.enum(TRANSACTION_TYPES).optional().catch(undefined),
  categoryId: z.uuid().optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
});

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

/** Bütçe: kategori boşsa genel aylık bütçe. Seçilen aydan itibaren her ay geçerlidir. */
export const budgetInputSchema = z.object({
  categoryId: z.uuid("categoryRequired").nullable(),
  amountMinor: z
    .number("amount")
    .int("amount")
    .positive("amountPositive")
    .max(MAX_AMOUNT_MINOR, "amountMax"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "date"),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;

/** Abonelik: nextChargeOn ilk (ya da bilinen bir) ödeme günüdür; sonrakiler hesaplanır. */
export const subscriptionInputSchema = z.object({
  name: z.string().trim().min(1, "required").max(60, "subscriptionNameMax"),
  amountMinor: z
    .number("amount")
    .int("amount")
    .positive("amountPositive")
    .max(MAX_AMOUNT_MINOR, "amountMax"),
  cycle: z.enum(["weekly", "monthly", "yearly"]),
  nextChargeOn: z.iso.date("date"),
  categoryId: z.uuid().nullable(),
  remindDaysBefore: z.number().int().min(0).max(14),
  note: z
    .string()
    .trim()
    .max(200, "noteMax")
    .transform((v) => (v === "" ? null : v)),
});

export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;
