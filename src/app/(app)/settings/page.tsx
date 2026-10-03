import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { DataSettings } from "@/features/settings/data-settings";
import { NotificationSettings } from "@/features/settings/notification-settings";
import { PushSettings } from "@/features/settings/push-settings";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { pushPublicKey } from "@/server/notify";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("settingsPage")]);
  const settings = await getSettings(await getDb(), user.id);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <NotificationSettings initial={settings} />
        <PushSettings publicKey={pushPublicKey()} />
        <DataSettings />
      </div>
    </>
  );
}
