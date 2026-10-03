"use client";

import { TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { Badge } from "@/components/ui/badge";

/** Tanıtımdaki sohbet örneği: mesajlar sırayla belirir, kart uygulamadaki kartın aynısıdır. */
export function ChatMock() {
  const t = useTranslations("landing.mock");
  const step = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.2 + i * 0.35, duration: 0.3 },
  });
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div aria-hidden className="ai-gradient absolute -inset-10 rounded-full opacity-20 blur-3xl dark:opacity-25" />
      <div className="relative rounded-[2rem] border border-border bg-surface p-4 shadow-raised">
        <div className="mb-4 flex items-center gap-2.5 px-1">
          <AssistantOrb size="sm" />
          <span className="text-small font-medium text-text">{t("title")}</span>
        </div>
        <div className="space-y-3">
          <motion.p {...step(0)} className="ml-auto w-fit max-w-[85%] rounded-[1.25rem] rounded-br-md bg-accent-strong px-4 py-2.5 text-small text-on-accent">
            {t("user")}
          </motion.p>
          <motion.div {...step(1)} className="flex gap-2.5">
            <AssistantOrb size="sm" className="mt-0.5" />
            <div className="space-y-2.5">
              <p className="text-small text-text">{t("reply")}</p>
              <div className="rounded-card border border-border/70 bg-bg p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-negative-soft text-negative">
                    <TrendingDown className="size-4" aria-hidden />
                  </span>
                  <div>
                    <Badge tone="positive" className="mb-1">
                      {t("done")}
                    </Badge>
                    <p className="text-small font-medium text-text tabular-nums">{t("card")}</p>
                    <p className="text-caption text-muted">{t("cardLine")}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.p {...step(2)} className="ml-auto w-fit max-w-[85%] rounded-[1.25rem] rounded-br-md bg-accent-strong px-4 py-2.5 text-small text-on-accent">
            {t("user2")}
          </motion.p>
          <motion.div {...step(3)} className="flex gap-2.5">
            <AssistantOrb size="sm" className="mt-0.5" />
            <p className="text-small text-text">{t("reply2")}</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
