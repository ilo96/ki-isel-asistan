"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { duration, ease } from "@/lib/motion";

/** Sekmeler arası geçiş: kısa fade + 8 px kayma. Kullanıcıyı bekletmez. */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.page, ease }}
    >
      {children}
    </motion.div>
  );
}
