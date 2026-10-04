"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "./theme-toggle";
import { useShell } from "./ui-store";

/** Üst bar: sayfa kaydırılınca cam efekti alır. Arama alanı komut paletini açar. */
export function TopBar({ unread }: { unread: number }) {
  const t = useTranslations("nav");
  const { open } = useShell();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b transition-[background-color,border-color] duration-[180ms]",
        scrolled ? "glass border-border/70" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/home" className="flex items-center gap-2 lg:hidden" aria-label={t("home")}>
          <BrandMark size="sm" />
        </Link>

        <button
          type="button"
          onClick={() => open("command")}
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface px-4 text-small text-muted transition-colors hover:border-accent/40 sm:max-w-md"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t("search")}</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex" aria-hidden>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/notifications"
            aria-label={unread ? t("notificationsUnread", { count: unread }) : t("notifications")}
            className="relative grid size-10 place-items-center rounded-full border border-border bg-surface text-text transition-colors hover:border-accent/40"
          >
            <Bell className="size-[18px]" aria-hidden />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-negative px-1 text-[11px] leading-none font-semibold text-white tabular-nums">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
