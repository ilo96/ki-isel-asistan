"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useShell, type QuickAddCapture, type QuickAddKind } from "./ui-store";

/** Ana ekran kısayolları ve widget düğmeleri: /home?ekle=gider|gelir|ses|fis */
const ADD: Record<string, { kind: QuickAddKind; capture: QuickAddCapture }> = {
  gider: { kind: "expense", capture: null },
  gelir: { kind: "income", capture: null },
  ses: { kind: "expense", capture: "voice" },
  fis: { kind: "expense", capture: "receipt" },
};

/**
 * Kabuğun görünmez yan etkileri: adres çubuğundaki ?ekle= hızlı ekle'yi açar; okunmamış
 * bildirim sayısı (destekleyen cihazlarda) uygulama simgesinde rozet olarak görünür.
 */
export function ShellEffects({ unread }: { unread: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useShell();
  const add = params.get("ekle");

  useEffect(() => {
    const target = add ? ADD[add] : undefined;
    if (!target) return;
    open("quickAdd", target);
    const rest = new URLSearchParams(params);
    rest.delete("ekle");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [add, open, params, pathname, router]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);

  return null;
}
