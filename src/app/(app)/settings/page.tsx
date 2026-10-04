import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ModuleSettings } from "@/features/fitness/module-settings";
import { DataSettings } from "@/features/settings/data-settings";
import { NotificationSettings } from "@/features/settings/notification-settings";
import { PushSettings } from "@/features/settings/push-settings";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { pushPublicKey } from "@/server/notify";
import { DEFAULT_FITNESS_SETTINGS, fitnessSettingsSchema } from "@/lib/validation/fitness";
import { getModuleState } from "@/server/services/modules";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("settingsPage")]);
  const db = await getDb();
  const [settings, fitness] = await Promise.all([getSettings(db, user.id), getModuleState(db, user.id, "fitness")]);
  const fitnessSettings = fitnessSettingsSchema.safeParse(fitness.settings);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <NotificationSettings initial={settings} />
        <PushSettings publicKey={pushPublicKey()} />
        <ModuleSettings
          enabled={fitness.enabled}
          settings={fitnessSettings.success ? fitnessSettings.data : DEFAULT_FITNESS_SETTINGS}
        />
        <DataSettings />
      </div>
    </>
  );
}
