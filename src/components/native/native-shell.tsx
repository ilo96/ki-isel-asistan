"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { isNative, nativePlatform } from "@/lib/native/platform";
import { onNativePushTap } from "@/lib/native/push";

/**
 * Mağaza uygulamasına özel görünmez davranışlar: durum çubuğu temaya uyar, Android geri tuşu
 * sayfa geçmişinde geri gider (en başta uygulamayı kapatır), bildirime dokununca ilgili sayfa
 * açılır. Tarayıcıda hiçbir şey yapmaz.
 */
export function NativeShell() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isNative()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { App } = await import("@capacitor/app");
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      });
      const stopTaps = await onNativePushTap((href) => router.push(href));
      cleanup = () => {
        void back.remove();
        stopTaps();
      };
      if (cancelled) cleanup();
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  useEffect(() => {
    if (!isNative() || !resolvedTheme) return;
    void import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
      // Style.Dark = açık renkli yazı (koyu zemin için).
      void StatusBar.setStyle({ style: resolvedTheme === "dark" ? Style.Dark : Style.Light }).catch(() => {});
      if (nativePlatform() === "android") {
        void StatusBar.setBackgroundColor({ color: resolvedTheme === "dark" ? "#0b0d12" : "#f7f8fb" }).catch(() => {});
      }
    });
  }, [resolvedTheme]);

  return null;
}
