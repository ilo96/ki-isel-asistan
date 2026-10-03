"use client";

import { ArrowUp } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AssistantOrb, type OrbState } from "@/components/assistant/assistant-orb";
import { staggerDelay } from "@/lib/motion";

/**
 * Sohbet ekranının iskeleti. Gerçek sohbet (stream, tool kartları) asistan
 * aşamasında bağlanacak; şimdilik öneri çipleri ve giriş alanı görünümü var.
 */
export function AssistantPreview() {
  const t = useTranslations("assistantPage");
  const [value, setValue] = useState("");
  const [orb, setOrb] = useState<OrbState>("idle");
  const suggestions = t.raw("suggestions") as string[];

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col lg:min-h-[calc(100dvh-10rem)]">
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <AssistantOrb size="xl" state={orb} />
        <h2 className="mt-6 text-h1 text-text">{t("emptyTitle")}</h2>
        <p className="mt-2 max-w-sm text-body text-muted">{t("emptyBody")}</p>
        <ul className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
          {suggestions.map((s, i) => (
            <motion.li
              key={s}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: staggerDelay(i) }}
            >
              <button
                type="button"
                onClick={() => setValue(s)}
                className="rounded-full border border-border bg-surface px-4 py-2.5 text-small text-text transition-colors hover:border-accent/50 hover:text-accent"
              >
                {s}
              </button>
            </motion.li>
          ))}
        </ul>
      </div>

      <form
        className="sticky bottom-24 lg:bottom-6"
        onSubmit={(e) => {
          e.preventDefault();
          setOrb("thinking");
        }}
      >
        <div className="glass flex items-center gap-2 rounded-sheet border border-border p-2 pl-5 shadow-raised">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (orb !== "idle") setOrb("idle");
            }}
            placeholder={t("inputPlaceholder")}
            aria-label={t("inputPlaceholder")}
            className="h-11 flex-1 bg-transparent text-body text-text outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label={t("inputPlaceholder")}
            className="grid size-11 place-items-center rounded-full bg-accent-strong text-on-accent transition-[transform,opacity] active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-center text-caption text-muted" aria-live="polite">
          {orb === "thinking" ? t("comingSoon") : " "}
        </p>
      </form>
    </div>
  );
}
