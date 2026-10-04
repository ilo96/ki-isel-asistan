"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { Sheet } from "@/components/ui/sheet";
import { useShell } from "./ui-store";

/** Yazı alanındayken kısayollar çalışmaz. */
function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Komut paleti yardım listesini bu olayla açar. */
export const SHOW_SHORTCUTS_EVENT = "app:shortcuts";

const GO: Record<string, string> = { h: "/home", f: "/finance", a: "/assistant", g: "/tasks", b: "/notifications" };

/**
 * Masaüstü kısayolları (plan: Faz 13): N hızlı ekle, / arama, ? yardım,
 * G ardından H/F/A/G/B ile ekranlar arası geçiş. ⌘K komut paletinde tanımlı.
 */
export function KeyboardShortcuts() {
  const t = useTranslations("shortcuts");
  const router = useRouter();
  const { overlay, open } = useShell();
  const [help, setHelp] = useState(false);
  const pendingGo = useRef(0);

  useEffect(() => {
    const show = () => setHelp(true);
    window.addEventListener(SHOW_SHORTCUTS_EVENT, show);
    return () => window.removeEventListener(SHOW_SHORTCUTS_EVENT, show);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || overlay || typing(e.target)) return;
      const key = e.key.toLowerCase();
      if (pendingGo.current > Date.now()) {
        pendingGo.current = 0;
        const href = GO[key];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (key === "n") {
        e.preventDefault();
        open("quickAdd");
      } else if (key === "/") {
        e.preventDefault();
        open("command");
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      } else if (key === "g") {
        pendingGo.current = Date.now() + 1200;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, open, router]);

  const rows: [string[], string][] = [
    [["⌘", "K"], t("palette")],
    [["/"], t("search")],
    [["N"], t("quickAdd")],
    [["G", "H"], t("home")],
    [["G", "F"], t("finance")],
    [["G", "A"], t("assistant")],
    [["G", "G"], t("tasks")],
    [["G", "B"], t("notifications")],
    [["?"], t("help")],
  ];

  return (
    <Sheet open={help} onOpenChange={setHelp} title={t("title")} closeLabel={t("close")}>
      <ul className="divide-y divide-border/60">
        {rows.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between py-2.5 text-body text-text">
            <span>{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
