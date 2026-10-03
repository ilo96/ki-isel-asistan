"use client";

import { ArrowUp, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { useState } from "react";
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
  const router = useRouter();
  const { open } = useShell();
  const [question, setQuestion] = useState("");

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

      {/* Mini asistan kutusu (yalnızca tam sidebar): yazılan soru sohbet ekranında açılır. */}
      <form
        className="mt-auto hidden rounded-card border border-border bg-bg p-4 transition-colors focus-within:border-accent/40 xl:block"
        onSubmit={(e) => {
          e.preventDefault();
          const q = question.trim();
          if (!q) return;
          setQuestion("");
          router.push(`/assistant?q=${encodeURIComponent(q)}`);
        }}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <AssistantOrb size="sm" />
          <span className="text-small text-text">{t("assistant.miniTitle")}</span>
        </div>
        <div className="flex items-center gap-2 rounded-input bg-surface py-1 pr-1 pl-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("assistant.miniPlaceholder")}
            aria-label={t("assistant.miniTitle")}
            className="h-8 min-w-0 flex-1 bg-transparent text-small text-text outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label={t("assistant.miniTitle")}
            className="grid size-8 shrink-0 place-items-center rounded-full text-accent transition-colors hover:bg-accent-soft"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
      </form>
    </aside>
  );
}
