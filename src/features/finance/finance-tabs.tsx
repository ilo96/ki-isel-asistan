"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

const TABS = [
  { key: "overview", href: "/finance" },
  { key: "transactions", href: "/finance/transactions" },
  { key: "budgets", href: "/finance/budgets" },
  { key: "subscriptions", href: "/finance/subscriptions" },
  { key: "categories", href: "/finance/categories" },
] as const;

/** Finans'ın alt sayfaları: Özet, İşlemler, Bütçeler, Abonelikler, Kategoriler. */
export function FinanceTabs() {
  const t = useTranslations("finance.tabs");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="-mx-1 mb-6 overflow-x-auto px-1">
      <ul className="inline-flex rounded-button bg-surface-muted p-1">
        {TABS.map(({ key, href }) => {
          const active = href === "/finance" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center rounded-[11px] px-3.5 text-small whitespace-nowrap transition-colors duration-[180ms]",
                  active ? "text-text" : "text-muted hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="finance-tab"
                    transition={spring.layout}
                    className="absolute inset-0 rounded-[11px] bg-surface shadow-card dark:bg-surface-raised"
                  />
                )}
                <span className="relative">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
