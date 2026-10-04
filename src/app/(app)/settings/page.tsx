import { LayoutGrid } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { ModuleSettings } from "@/features/fitness/module-settings";
import { DataSettings } from "@/features/settings/data-settings";
import { NotificationSettings } from "@/features/settings/notification-settings";
import { PushSettings } from "@/features/settings/push-settings";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { isAppRequest } from "@/server/app-request";
import { nativePushReady, pushPublicKey } from "@/server/notify";
import { DEFAULT_FITNESS_SETTINGS, fitnessSettingsSchema } from "@/lib/validation/fitness";
import { getModuleState } from "@/server/services/modules";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const [user, t, tw, inApp] = await Promise.all([
    requireUser(),
    getTranslations("settingsPage"),
    getTranslations("widget"),
    isAppRequest(),
  ]);
  const db = await getDb();
  const [settings, fitness] = await Promise.all([getSettings(db, user.id), getModuleState(db, user.id, "fitness")]);
  const fitnessSettings = fitnessSettingsSchema.safeParse(fitness.settings);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <NotificationSettings initial={settings} />
        <PushSettings publicKey={pushPublicKey()} nativeReady={nativePushReady()} />
        {/* Ana ekran widget'ı tarayıcı için bir geçici çözüm; mağaza uygulamasında gösterilmez. */}
        {!inApp && (
          <Card>
            <CardTitle>{tw("settingsTitle")}</CardTitle>
            <p className="mt-1 text-small text-muted">{tw("settingsBody")}</p>
            <Link href="/widget" className="mt-4 inline-flex h-11 items-center gap-2 rounded-button bg-accent-soft px-4 text-body text-accent">
              <LayoutGrid className="size-[18px]" aria-hidden />
              {tw("settingsOpen")}
            </Link>
          </Card>
        )}
        <ModuleSettings
          enabled={fitness.enabled}
          settings={fitnessSettings.success ? fitnessSettings.data : DEFAULT_FITNESS_SETTINGS}
        />
        <DataSettings />
      </div>
    </>
  );
}
