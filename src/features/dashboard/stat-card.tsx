"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { duration, ease, staggerDelay } from "@/lib/motion";

type StatCardProps = {
  label: string;
  /** Server sayfasından gelir; bileşen (fonksiyon) değil, render edilmiş ikon. */
  icon: ReactNode;
  index: number;
  children: ReactNode;
  footer?: ReactNode;
  /** Verilirse kartın tamamı bu sayfaya götürür. */
  href?: string;
};

/** Dashboard kartı: sırayla (100 ms + 50 ms arayla) gelir. */
export function StatCard({ label, icon, index, children, footer, href }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.page, ease, delay: staggerDelay(index) }}
      className={cn(
        "relative flex min-h-32 flex-col rounded-card border border-border/60 bg-surface p-5 shadow-card dark:border-transparent",
        href && "transition-colors duration-[180ms] hover:border-accent/40",
      )}
    >
      {href && (
        <Link
          href={href}
          aria-label={label}
          className="absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-accent"
        />
      )}
      <div className="flex items-center gap-2 text-small text-muted">
        <span className="[&_svg]:size-4" aria-hidden>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-auto pt-4 text-[1.375rem] leading-7 font-semibold tracking-tight sm:text-h1">
        {children}
      </div>
      {/* Alt satır her kartta yer tutar; rakamlar aynı hizada kalsın */}
      <div className="mt-1.5 min-h-5">{footer}</div>
    </motion.div>
  );
}
