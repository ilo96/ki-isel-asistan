"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { NAV_ITEMS, isActive, type NavItem } from "./nav-items";
import { useShell } from "./ui-store";

/** < 1024 px: cam efektli alt bar, ortada yüzen "+" Hızlı ekle. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { open } = useShell();
  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  const renderItem = ({ key, href, icon: Icon }: NavItem) => {
    const active = isActive(pathname, href);
    return (
      <li key={key} className="flex-1">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex h-14 flex-col items-center justify-center gap-0.5 text-caption transition-colors",
            active ? "text-accent" : "text-muted",
          )}
        >
          {active && (
            <motion.span
              layoutId="bottom-active"
              transition={spring.layout}
              className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
            />
          )}
          <motion.span whileTap={{ scale: 0.88 }}>
            <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
          </motion.span>
          <span>{t(key)}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={t("main")}
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border/70 pb-safe lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-center px-2">
        {left.map(renderItem)}
        <li className="flex w-16 justify-center">
          <motion.button
            type="button"
            onClick={() => open("quickAdd")}
            whileTap={{ scale: 0.92 }}
            aria-label={t("quickAdd")}
            className="-mt-6 grid size-14 place-items-center rounded-full bg-accent-strong text-on-accent shadow-raised ring-4 ring-bg"
          >
            <Plus className="size-6" aria-hidden />
          </motion.button>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
