import "server-only";
import { eq, inArray, isNotNull } from "drizzle-orm";
import webpush from "web-push";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import type { Db } from "@/server/db/client";
import { notifications, pushSubscriptions, users, type Notification } from "@/server/db/schema";
import { env } from "@/server/env";
import { generateNotifications, type NotificationUser } from "@/server/services/notifications";

/*
 * Bildirimleri üretir ve (VAPID anahtarları varsa) Web Push ile gönderir. Zamanlanmış iş
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

async function push(db: Db, userId: string, items: Notification[]) {
  if (!pushReady() || items.length === 0) return;
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
