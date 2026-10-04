import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time");

/** Bildirim tercihleri (plan: Bildirim stratejisi). Günlük sınır 1–10. */
export const settingsInputSchema = z.object({
  notifyBills: z.boolean(),
  notifyReminders: z.boolean(),
  notifyBudget: z.boolean(),
  notifyWeekly: z.boolean(),
  notifyDaily: z.boolean(),
  dailyTime: time,
  notifyAchievements: z.boolean(),
  notifySubscriptions: z.boolean(),
  quietStart: time,
  quietEnd: time,
  dailyLimit: z.number().int().min(1).max(10),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const DEFAULT_SETTINGS: SettingsInput = {
  notifyBills: true,
  notifyReminders: true,
  notifyBudget: true,
  notifyWeekly: true,
  notifyDaily: true,
  dailyTime: "08:30",
  notifyAchievements: true,
  notifySubscriptions: true,
  quietStart: "22:00",
  quietEnd: "08:00",
  dailyLimit: 3,
};

/** Hesap silme, yanlışlıkla olmasın diye kullanıcının bu kelimeyi yazmasını ister. */
export const DELETE_CONFIRM_WORD = "SİL";
