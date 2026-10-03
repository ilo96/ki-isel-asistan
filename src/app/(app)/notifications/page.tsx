import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { NotificationList, type NotificationRow } from "@/features/notifications/notification-list";
import { dayIn, DEFAULT_TIMEZONE, timeIn } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { notifyUserThrottled } from "@/server/notify";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("notificationsPage")]);
  const tz = user.timezone ?? DEFAULT_TIMEZONE;
  const db = await getDb();
  await notifyUserThrottled(db, {
    id: user.id,
    timezone: tz,
    currency: (user.currency ?? DEFAULT_CURRENCY) as CurrencyCode,
  });
  const rows = await listNotifications(db, user.id);
  const today = dayIn(new Date(), tz);
  const short = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: tz });

  const items: NotificationRow[] = rows.map((n) => {
    const isToday = dayIn(n.createdAt, tz) === today;
    return {
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      read: !!n.readAt,
      today: isToday,
      when: isToday ? timeIn(n.createdAt, tz) : short.format(n.createdAt),
    };
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Button asChild variant="secondary" size="icon" aria-label={t("settings")}>
            <Link href="/settings">
              <Settings aria-hidden />
            </Link>
          </Button>
        }
      />
      <NotificationList items={items} />
    </>
  );
}
