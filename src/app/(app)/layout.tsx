import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { notifyUserThrottled } from "@/server/notify";
import { unreadCount } from "@/server/services/notifications";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  // Cron yokken de (yerelde) bildirimler oluşsun; en sık 5 dakikada bir çalışır.
  await notifyUserThrottled(db, {
    id: user.id,
    timezone: user.timezone ?? DEFAULT_TIMEZONE,
    currency: (user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
  });
  const unread = await unreadCount(db, user.id);
  return <AppShell unread={unread}>{children}</AppShell>;
}
