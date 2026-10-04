"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { SettingsInput } from "@/lib/validation/settings";
import { saveSettingsAction } from "@/features/notifications/actions";

const timeClass =
  "h-11 w-full rounded-input border border-border bg-surface px-3 text-body text-text tabular-nums focus-visible:border-accent focus-visible:outline-none";

export function NotificationSettings({ initial }: { initial: SettingsInput }) {
  const t = useTranslations("settingsPage");
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof SettingsInput>(key: K, v: SettingsInput[K]) => setValue((s) => ({ ...s, [key]: v }));
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);

  return (
    <Card>
      <CardTitle>{t("notifications")}</CardTitle>
      <p className="mt-1 text-small text-muted">{t("notificationsBody", { limit: value.dailyLimit })}</p>
      <div className="mt-4 rounded-input bg-surface-muted px-4 pt-1 pb-3">
        <Switch
          label={t("daily")}
          description={t("dailyBody")}
          checked={value.notifyDaily}
          onCheckedChange={(v) => set("notifyDaily", v)}
        />
        {value.notifyDaily && (
          <label className="mt-3 block max-w-40 space-y-1.5">
            <span className="text-caption text-muted">{t("dailyTime")}</span>
            <input
              type="time"
              value={value.dailyTime}
              onChange={(e) => set("dailyTime", e.target.value)}
              className={timeClass}
            />
          </label>
        )}
      </div>
      <div className="mt-3 divide-y divide-border/60">
        <Switch label={t("bills")} checked={value.notifyBills} onCheckedChange={(v) => set("notifyBills", v)} />
        <Switch label={t("reminders")} checked={value.notifyReminders} onCheckedChange={(v) => set("notifyReminders", v)} />
        <Switch label={t("budget")} checked={value.notifyBudget} onCheckedChange={(v) => set("notifyBudget", v)} />
        <Switch
          label={t("subscriptions")}
          checked={value.notifySubscriptions}
          onCheckedChange={(v) => set("notifySubscriptions", v)}
        />
        <Switch label={t("weekly")} checked={value.notifyWeekly} onCheckedChange={(v) => set("notifyWeekly", v)} />
        <Switch
          label={t("achievements")}
          checked={value.notifyAchievements}
          onCheckedChange={(v) => set("notifyAchievements", v)}
        />
      </div>

      <div className="mt-5 border-t border-border/60 pt-5">
        <p className="text-body text-text">{t("quiet")}</p>
        <p className="text-small text-muted">{t("quietBody")}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-caption text-muted">{t("from")}</span>
            <input type="time" value={value.quietStart} onChange={(e) => set("quietStart", e.target.value)} className={timeClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-caption text-muted">{t("to")}</span>
            <input type="time" value={value.quietEnd} onChange={(e) => set("quietEnd", e.target.value)} className={timeClass} />
          </label>
          <label className="col-span-2 space-y-1.5 sm:col-span-1">
            <span className="text-caption text-muted">{t("dailyLimit")}</span>
            <select value={value.dailyLimit} onChange={(e) => set("dailyLimit", Number(e.target.value))} className={timeClass}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveSettingsAction(value);
              toast(r.ok ? { message: t("saved"), tone: "success" } : { message: t("error"), tone: "error" });
            })
          }
        >
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}
