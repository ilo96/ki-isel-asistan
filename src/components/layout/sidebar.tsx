"use client";

import { ArrowUp, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { NAV_ITEMS, isActive } from "./nav-items";
import { useShell } from "./ui-store";

/**
 * 1024–1279 px: 72 px ikon sidebar. ≥ 1280 px: 248 px tam sidebar + mini asistan kutusu.
 * Telefonda ve tablette gizli; orada alt bar kullanılır.
 */
export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { open } = useShell();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex xl:w-[248px] xl:px-4">
      <Link href="/home" className="mb-8 flex items-center gap-3 px-1.5 xl:px-2">
        <AssistantOrb size="sm" />
        <span className="hidden text-h2 tracking-tight xl:inline">{t("app.name")}</span>
      </Link>

      <button
        type="button"
        onClick={() => open("quickAdd")}
        className="mb-6 flex h-11 items-center justify-center gap-2 rounded-button bg-accent-strong text-on-accent shadow-card transition-transform duration-[120ms] active:scale-[0.97] xl:justify-start xl:px-4"
        aria-label={t("nav.quickAdd")}
      >
        <Plus className="size-5" aria-hidden />
        <span className="hidden font-medium xl:inline">{t("nav.quickAdd")}</span>
      </button>

      <nav aria-label={t("nav.main")}>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={t(`nav.${key}`)}
                  className={cn(
                    "relative flex h-11 items-center justify-center gap-3 rounded-button text-body transition-colors xl:justify-start xl:px-3",
                    active ? "font-medium text-accent" : "text-muted hover:bg-surface-muted hover:text-text",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={spring.layout}
                      className="absolute inset-0 rounded-button bg-accent-soft"
                    />
                  )}
                  <Icon className="relative size-5" aria-hidden />
                  <span className="relative hidden xl:inline">{t(`nav.${key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mini asistan kutusu (yalnızca tam sidebar) */}
      <div className="mt-auto hidden xl:block">
        <Link
          href="/assistant"
          className="group block rounded-card border border-border bg-bg p-4 transition-colors hover:border-accent/40"
        >
          <div className="mb-3 flex items-center gap-2.5">
            <AssistantOrb size="sm" />
            <span className="text-small text-text">{t("assistant.miniTitle")}</span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-input bg-surface px-3 py-2.5 text-small text-muted">
            <span className="truncate">{t("assistant.miniPlaceholder")}</span>
            <ArrowUp className="size-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5" aria-hidden />
          </div>
        </Link>
      </div>
    </aside>
  );
}
