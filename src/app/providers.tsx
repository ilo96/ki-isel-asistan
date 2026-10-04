"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { NativeShell } from "@/components/native/native-shell";
import { isNative } from "@/lib/native/platform";

/**
 * Servis çalışanı yalnızca production'da ve tarayıcıda; geliştirmede önbellek kafa
 * karıştırmasın. Mağaza uygulamasında çevrimdışı sayfa ve bildirimler yerel kabuktan gelir.
 */
function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (isNative()) {
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
      return;
    }
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* prefers-reduced-motion açıksa Motion hareketleri kendiliğinden kısaltır */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <NativeShell />
    </ThemeProvider>
  );
}
