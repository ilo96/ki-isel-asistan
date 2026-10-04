import "server-only";
import { eq, inArray, isNotNull } from "drizzle-orm";
import webpush from "web-push";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import type { Db } from "@/server/db/client";
import { deviceTokens, notifications, pushSubscriptions, users, type Notification } from "@/server/db/schema";
import { env } from "@/server/env";
import { sendApns, sendFcm, type ApnsKey, type FcmAccount, type NativeMessage, type SendResult } from "@/server/native-push";
import { generateNotifications, type NotificationUser } from "@/server/services/notifications";

/*
 * Bildirimleri üretir; mağaza uygulamasına (FCM / APNs anahtarları varsa) ve tarayıcıya
 * (VAPID anahtarları varsa) gönderir. Zamanlanmış iş
 * (/api/cron/notifications) tüm kullanıcılar için, uygulama düzeni ise oturumdaki kullanıcı
 * için (en sık 5 dakikada bir) çağırır; böylece cron olmadan da uygulama içi bildirim oluşur.
 */

let configured: boolean | undefined;
function pushReady() {
  if (configured !== undefined) return configured;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env();
  configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  if (configured) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  return configured;
}

export const pushPublicKey = () => (pushReady() ? env().VAPID_PUBLIC_KEY! : null);

function fcmAccount(): FcmAccount | null {
  const raw = env().FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FcmAccount;
    return parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    console.error("FCM_SERVICE_ACCOUNT geçerli bir JSON değil");
    return null;
  }
}

function apnsKey(): ApnsKey | null {
  const e = env();
  if (!e.APNS_KEY_ID || !e.APNS_PRIVATE_KEY || !e.APPLE_TEAM_ID) return null;
  return {
    teamId: e.APPLE_TEAM_ID,
    keyId: e.APNS_KEY_ID,
    privateKey: e.APNS_PRIVATE_KEY,
    bundleId: e.APPLE_APP_BUNDLE_IDENTIFIER,
    sandbox: e.APNS_ENV === "sandbox",
  };
}

/** Mağaza uygulamasının bildirim belirteçleri tanımlı mı (Ayarlar'daki düğme için). */
export const nativePushReady = () => ({ android: fcmAccount() !== null, ios: apnsKey() !== null });

/** Mağaza uygulaması: her cihaz belirtecine, platformunun servisiyle. */
async function pushNative(db: Db, userId: string, items: Notification[]): Promise<boolean> {
  const fcm = fcmAccount();
  const apns = apnsKey();
  if (!fcm && !apns) return false;
  const devices = await db.select().from(deviceTokens).where(eq(deviceTokens.userId, userId));
  if (devices.length === 0) return false;
  const gone = new Set<string>();
  let sent = false;
  for (const item of items) {
    const message: NativeMessage = { title: item.title, body: item.body, href: item.href ?? "/notifications", tag: item.dedupeKey };
    const results = await Promise.all(
      devices.map(async (d): Promise<SendResult> => {
        if (gone.has(d.id)) return "gone";
        const r =
          d.platform === "android"
            ? fcm ? await sendFcm(fcm, d.token, message).catch(() => "error" as const) : "error"
            : apns ? await sendApns(apns, d.token, message) : "error";
        if (r === "gone") gone.add(d.id);
        return r;
      }),
    );
    sent ||= results.includes("ok");
  }
  if (gone.size) await db.delete(deviceTokens).where(inArray(deviceTokens.id, [...gone]));
  return sent;
}

async function push(db: Db, userId: string, items: Notification[]) {
  if (items.length === 0) return;
  const nativeSent = await pushNative(db, userId, items);
  if (nativeSent) await markPushed(db, items);
  if (!pushReady()) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return;
  const gone: string[] = [];
  for (const item of items) {
    const payload = JSON.stringify({ title: item.title, body: item.body, href: item.href ?? "/notifications", tag: item.dedupeKey });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // Abonelik iptal edilmiş: bir daha denenmesin.
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error("Push gönderilemedi", status);
        }
      }),
    );
  }
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  await markPushed(db, items);
}

async function markPushed(db: Db, items: Notification[]) {
  await db
    .update(notifications)
    .set({ pushedAt: new Date() })
    .where(inArray(notifications.id, items.map((i) => i.id)));
}

export async function notifyUser(db: Db, user: NotificationUser, now = new Date()) {
  const created = await generateNotifications(db, user, now);
  await push(db, user.id, created);
  return created.length;
}

const THROTTLE_MS = 5 * 60_000;
const lastRun = new Map<string, { at: number; done: Promise<void> }>();

/**
 * Sayfa açılışında: hata sayfayı bozmasın, sık çalışmasın. Düzen ve sayfa aynı anda
 * çağırırsa ikisi de aynı çalıştırmayı bekler (bildirim listesi eksik görünmesin).
 */
export function notifyUserThrottled(db: Db, user: NotificationUser): Promise<void> {
  const now = Date.now();
  const last = lastRun.get(user.id);
  if (last && last.at + THROTTLE_MS > now) return last.done;
  const done = notifyUser(db, user).then(
    () => undefined,
    (error: unknown) => console.error("Bildirimler üretilemedi", error),
  );
  lastRun.set(user.id, { at: now, done });
  return done;
}

/** Zamanlanmış iş: onboarding'i bitirmiş her kullanıcı. */
export async function notifyAll(db: Db, now = new Date()) {
  const rows = await db
    .select({ id: users.id, name: users.name, timezone: users.timezone, currency: users.currency })
    .from(users)
    .where(isNotNull(users.onboardedAt));
  let created = 0;
  for (const u of rows) {
    try {
      created += await notifyUser(
        db,
        {
          id: u.id,
          name: u.name,
          timezone: u.timezone ?? DEFAULT_TIMEZONE,
          currency: (u.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
        },
        now,
      );
    } catch (error) {
      console.error(`Bildirim işi başarısız: ${u.id}`, error);
    }
  }
  return { users: rows.length, created };
}
