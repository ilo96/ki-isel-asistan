"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export type OrbState = "idle" | "thinking" | "done" | "error";

const sizes = { sm: "size-7", md: "size-10", lg: "size-14", xl: "size-20" } as const;

type AssistantOrbProps = {
  state?: OrbState;
  size?: keyof typeof sizes;
  className?: string;
};

/**
 * Asistanın yüzü: AI gradient'iyle dolu bir küre. Durumunu hareketiyle anlatır
 * (plan: Asistanın kimliği). Dekoratiftir; durum metni her zaman yanında yazılır.
 */
export function AssistantOrb({ state = "idle", size = "md", className }: AssistantOrbProps) {
  return (
    <span aria-hidden className={cn("relative inline-grid shrink-0 place-items-center", sizes[size], className)}>
      {/* Yumuşak hale */}
      <span
        className={cn(
          "ai-gradient absolute inset-0 rounded-full opacity-40 blur-md transition-opacity duration-500",
          state === "error" && "opacity-0",
        )}
      />
      <span
        className={cn(
          "relative size-full overflow-hidden rounded-full",
          state === "idle" && "animate-breathe",
          state === "error" && "grayscale-[70%]",
        )}
      >
        <span
          className={cn(
            "absolute -inset-1/4 rounded-full",
            "bg-[conic-gradient(from_0deg,var(--ai-1),var(--ai-2),var(--ai-3),var(--ai-1))]",
            state === "thinking" && "animate-orb-spin",
          )}
        />
        {/* Işık noktası: küreye derinlik verir */}
        <span className="absolute top-[14%] left-[20%] size-[38%] rounded-full bg-white/50 blur-[6px]" />
      </span>
      {state === "done" && (
        <motion.span
          className="absolute inset-0 rounded-full ring-2 ring-ai-2"
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      )}
    </span>
  );
}
