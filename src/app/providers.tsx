"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

/** Servis çalışanı yalnızca production'da; geliştirmede önbellek kafa karıştırmasın. */
function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* prefers-reduced-motion açıksa Motion hareketleri kendiliğinden kısaltır */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
