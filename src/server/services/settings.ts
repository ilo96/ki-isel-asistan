import { eq } from "drizzle-orm";
import {
  DEFAULT_SETTINGS,
  settingsInputSchema,
  type SettingsInput,
} from "@/lib/validation/settings";
import type { Db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";

/** Ayar satırı yoksa varsayılanlar döner; ilk kayıtta satır oluşur. */
export async function getSettings(db: Db, userId: string): Promise<SettingsInput> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (!row) return DEFAULT_SETTINGS;
  return {
    notifyBills: row.notifyBills,
    notifyReminders: row.notifyReminders,
    notifyBudget: row.notifyBudget,
    notifyWeekly: row.notifyWeekly,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
    dailyLimit: row.dailyLimit,
  };
}

export async function updateSettings(db: Db, userId: string, input: SettingsInput) {
  const data = settingsInputSchema.parse(input);
  await db
    .insert(userSettings)
    .values({ userId, ...data })
    .onConflictDoUpdate({ target: userSettings.userId, set: data });
}
