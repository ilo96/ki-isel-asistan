"use client";

import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/features/notifications/actions";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

/** VAPID anahtarı base64url → Uint8Array (PushManager.subscribe bunu ister). */
function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations("settingsPage");
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  const enable = () =>
    start(async () => {
      if (!publicKey) return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const r = await savePushSubscriptionAction(sub.toJSON());
      setState(r.ok ? "on" : "off");
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  const note =
    !publicKey
      ? t("pushNotConfigured")
      : state === "unsupported"
        ? t("pushUnsupported")
        : state === "denied"
          ? t("pushDenied")
          : state === "on"
            ? t("pushOn")
            : null;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <BellRing className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>{t("push")}</CardTitle>
          <p className="mt-1 text-small text-muted">{t("pushBody")}</p>
          {note && <p className="mt-2 text-small text-text">{note}</p>}
        </div>
      </div>
      {publicKey && (state === "off" || state === "on") && (
        <div className="mt-4 flex justify-end">
          {state === "off" ? (
            <Button loading={pending} onClick={enable}>
              {t("pushEnable")}
            </Button>
          ) : (
            <Button variant="ghost" loading={pending} onClick={disable}>
              {t("pushDisable")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
