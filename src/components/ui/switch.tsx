"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

/** Etiketli aç/kapa satırı; tüm satır tıklanabilir (44 px'ten büyük dokunma alanı). */
export function Switch({ checked, onCheckedChange, label, description, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center gap-4 py-3 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-body text-text">{label}</span>
        {description && <span className="block text-small text-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-[180ms]",
          checked ? "justify-end bg-accent-strong" : "justify-start bg-border",
        )}
      >
        <motion.span layout transition={spring.layout} className="size-6 rounded-full bg-white shadow-card" />
      </span>
    </button>
  );
}
