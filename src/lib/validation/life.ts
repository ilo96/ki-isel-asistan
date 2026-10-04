import { z } from "zod";
import { FREQUENCIES } from "@/lib/recurrence";
import { MAX_AMOUNT_MINOR } from "./finance";

/*
 * Hatırlatıcı ve görev şemaları; form, server action ve asistanın tool'ları aynı şemayı kullanır.
 * Tarih kullanıcının takvim günü, saat onun saat dilimindeki "HH:MM"dır; ana sunucu çevirir.
 */

export const REMINDER_KINDS = ["reminder", "bill", "important_date"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
export const REPEAT_OPTIONS = ["none", ...FREQUENCIES] as const;

const title = z.string().trim().min(1, "required").max(120, "titleMax");
const note = z
  .string()
  .trim()
  .max(500, "noteMax")
  .transform((v) => (v === "" ? null : v));

export const reminderInputSchema = z.object({
  kind: z.enum(REMINDER_KINDS),
  title,
  note,
  date: z.iso.date("date"),
  /** null: tüm gün. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time")
    .nullable(),
  priority: z.enum(PRIORITIES),
  repeat: z.enum(REPEAT_OPTIONS),
  amountMinor: z
    .number("amount")
    .int("amount")
    .positive("amountPositive")
    .max(MAX_AMOUNT_MINOR, "amountMax")
    .nullable(),
  categoryId: z.uuid().nullable(),
});

export type ReminderInput = z.input<typeof reminderInputSchema>;

export const taskInputSchema = z.object({
  title,
  note,
  dueOn: z.iso.date("date").nullable(),
  priority: z.enum(PRIORITIES),
});

export type TaskInput = z.input<typeof taskInputSchema>;

export const LIFE_TABS = ["today", "upcoming", "done"] as const;
export type LifeTab = (typeof LIFE_TABS)[number];
