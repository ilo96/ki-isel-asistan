"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { FitnessSettings } from "@/lib/validation/fitness";
import { saveModuleAction } from "./actions";

/**
 * Ayarlar › Eklentiler: Spor & Sağlık'ı aç/kapat ve bildirimlerini seç. Her değişiklik
 * hemen kaydedilir. Kapatmak verileri silmez; ekran, asistan araçları ve bildirimler durur.
 */
export function ModuleSettings({
  enabled: initialEnabled,
  settings: initial,
}: {
  enabled: boolean;
  settings: FitnessSettings;
}) {
  const t = useTranslations("fitness.settings");
  const toast = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [settings, setSettings] = useState(initial);
  const [pending, start] = useTransition();

  const save = (
    patch: { enabled?: boolean; settings?: Partial<FitnessSettings> },
    rollback: () => void,
  ) =>
    start(async () => {
      const r = await saveModuleAction("fitness", patch);
      if (!r.ok) {
        rollback();
        toast({ message: t("error"), tone: "error" });
      }
    });

  const toggle = (key: keyof FitnessSettings, v: boolean) => {
    const before = settings;
    setSettings((s) => ({ ...s, [key]: v }));
    save({ settings: { [key]: v } }, () => setSettings(before));
  };

  return (
    <Card>
      <CardTitle>{t("title")}</CardTitle>
      <p className="mt-1 text-small text-muted">{t("body")}</p>
      <div className="mt-3 flex items-start gap-3 rounded-input border border-border/60 p-3">
        <span className="mt-3 grid size-10 shrink-0 place-items-center rounded-full bg-positive-soft text-positive">
          <Activity className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Switch
            label={t("fitness")}
            description={t("fitnessBody")}
            checked={enabled}
            disabled={pending}
            onCheckedChange={(v) => {
              setEnabled(v);
              save({ enabled: v }, () => setEnabled(!v));
            }}
          />
          {enabled && (
            <div className="divide-y divide-border/60 border-t border-border/60">
              <Switch
                label={t("weighIn")}
                description={t("weighInBody")}
                checked={settings.notifyWeighIn}
                onCheckedChange={(v) => toggle("notifyWeighIn", v)}
              />
              <Switch
                label={t("workout")}
                description={t("workoutBody")}
                checked={settings.notifyWorkout}
                onCheckedChange={(v) => toggle("notifyWorkout", v)}
              />
              <Switch
                label={t("goal")}
                description={t("goalBody")}
                checked={settings.notifyGoal}
                onCheckedChange={(v) => toggle("notifyGoal", v)}
              />
            </div>
          )}
          {enabled && (
            <Link
              href="/fitness"
              className="mt-2 inline-block text-small text-accent hover:underline"
            >
              {t("open")}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
