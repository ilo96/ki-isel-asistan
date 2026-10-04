"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { settingsInputSchema, type SettingsInput } from "@/lib/validation/settings";
import { getSession } from "@/server/auth";
import { getDb } from "@/server/db";
import { deviceTokens, pushSubscriptions } from "@/server/db/schema";
import { markRead } from "@/server/services/notifications";
import { updateSettings } from "@/server/services/settings";

type Result = { ok: true } | { ok: false; error: "unauthorized" | "invalid" | "unknown" };

async function withUser(fn: (userId: string) => Promise<void>): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  try {
    await fn(session.user.id);
    return { ok: true };
  } catch (error) {
    console.error("Bildirim işlemi başarısız", error);
    return { ok: false, error: "unknown" };
  }
}

export async function markReadAction(id: string | "all"): Promise<Result> {
  if (id !== "all" && !z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const result = await withUser(async (userId) => markRead(await getDb(), userId, id));
  revalidatePath("/", "layout");
  return result;
}

export async function saveSettingsAction(input: SettingsInput): Promise<Result> {
  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return withUser(async (userId) => updateSettings(await getDb(), userId, parsed.data));
}

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscriptionAction(input: unknown): Promise<Result> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { endpoint, keys } = parsed.data;
  return withUser(async (userId) => {
    await (await getDb())
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: keys.p256dh, auth: keys.auth },
      });
  });
}

export async function removePushSubscriptionAction(endpoint: string): Promise<Result> {
  return withUser(async (userId) => {
    await (await getDb())
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  });
}

const deviceTokenSchema = z.object({
  platform: z.enum(["ios", "android"]),
  // FCM belirteçleri ~160, APNs belirteçleri 64 karakter; boşluk ya da tuhaf karakter içermez.
  token: z.string().min(32).max(4096).regex(/^[\w:.-]+$/),
});

/** Mağaza uygulaması: cihazın bildirim belirteci. Aynı cihaz başka hesaba geçerse ona taşınır. */
export async function saveDeviceTokenAction(input: unknown): Promise<Result> {
  const parsed = deviceTokenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { platform, token } = parsed.data;
  return withUser(async (userId) => {
    await (await getDb())
      .insert(deviceTokens)
      .values({ userId, platform, token })
      .onConflictDoUpdate({ target: deviceTokens.token, set: { userId, platform } });
  });
}

export async function removeDeviceTokenAction(token: string): Promise<Result> {
  return withUser(async (userId) => {
    await (await getDb())
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
  });
}
