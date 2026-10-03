"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { duration, ease, staggerDelay } from "@/lib/motion";

type StatCardProps = {
  label: string;
  /** Server sayfasından gelir; bileşen (fonksiyon) değil, render edilmiş ikon. */
  icon: ReactNode;
  index: number;
  children: ReactNode;
  footer?: ReactNode;
};

/** Dashboard kartı: sırayla (100 ms + 50 ms arayla) gelir. */
export function StatCard({ label, icon, index, children, footer }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.page, ease, delay: staggerDelay(index) }}
      className="flex min-h-32 flex-col rounded-card border border-border/60 bg-surface p-5 shadow-card dark:border-transparent"
    >
      <div className="flex items-center gap-2 text-small text-muted">
        <span className="[&_svg]:size-4" aria-hidden>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-auto pt-4 text-h1">{children}</div>
      {/* Alt satır her kartta yer tutar; rakamlar aynı hizada kalsın */}
      <div className="mt-1.5 min-h-4">{footer}</div>
    </motion.div>
  );
}
