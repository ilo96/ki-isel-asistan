"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

const OPTIONS = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
] as const;

type ThemeToggleProps = { withLabels?: boolean; className?: string };

export function ThemeToggle({ withLabels = false, className }: ThemeToggleProps) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  // Tema yalnızca istemcide bilinir; ilk render'da seçim gösterilmez.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn("inline-flex rounded-full bg-surface-muted p-1", className)}
    >
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(value)}
            title={t(value)}
            onClick={() => setTheme(value)}
            className={cn(
              "relative flex h-8 items-center justify-center gap-1.5 rounded-full text-small transition-colors",
              withLabels ? "px-3" : "w-8",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {active && (
              <motion.span
                layoutId={withLabels ? "theme-pill-labeled" : "theme-pill"}
                transition={spring.layout}
                className="absolute inset-0 rounded-full bg-surface shadow-card dark:bg-surface-raised"
              />
            )}
            <Icon className="relative size-4" aria-hidden />
            {withLabels && <span className="relative">{t(value)}</span>}
          </button>
        );
      })}
    </div>
  );
}
