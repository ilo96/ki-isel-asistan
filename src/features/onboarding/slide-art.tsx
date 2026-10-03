"use client";

import { CalendarClock, Cake, Home, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";

/*
 * Tanıtım kartlarının görselleri. Resim dosyası değil, uygulamanın kendi componentleriyle
 * kurulur; böylece light/dark temaya ve gerçek arayüze birebir uyar.
 */

const frame =
  "relative mx-auto w-full max-w-[320px] rounded-sheet border border-border/60 bg-surface p-5 shadow-raised dark:border-transparent";

export function AssistantArt() {
  const t = useTranslations("onboarding.illustration");
  return (
    <div className={frame}>
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-[18px] rounded-br-md bg-accent-strong px-4 py-2.5 text-small text-on-accent">
          {t("userSays")}
        </p>
      </div>
      <div className="mt-4 flex items-end gap-2.5">
        <AssistantOrb size="sm" state="done" />
        <p className="max-w-[85%] rounded-[18px] rounded-bl-md bg-surface-muted px-4 py-2.5 text-small text-text">
          {t("assistantSays")}
        </p>
      </div>
    </div>
  );
}

export function MoneyArt() {
  const t = useTranslations("quickAdd");
  return (
    <div className={`${frame} space-y-3`}>
      <div className="flex items-center justify-between rounded-card bg-surface-muted px-4 py-3">
        <span className="flex items-center gap-2 text-small text-muted">
          <TrendingUp className="size-4 text-positive" aria-hidden /> {t("income")}
        </span>
        <Amount minor={4_500_000} kind="income" compact className="text-body font-semibold" />
      </div>
      <div className="flex items-center justify-between rounded-card bg-surface-muted px-4 py-3">
        <span className="flex items-center gap-2 text-small text-muted">
          <TrendingDown className="size-4 text-negative" aria-hidden /> {t("expense")}
        </span>
        <Amount minor={2_870_000} kind="expense" compact className="text-body font-semibold" />
      </div>
      <div className="px-1 pt-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-[64%] rounded-full ai-gradient" />
        </div>
      </div>
    </div>
  );
}

export function RemindArt() {
  const t = useTranslations("onboarding.illustration");
  const items = [
    { icon: Home, title: t("rent"), when: t("tomorrow"), urgent: true },
    { icon: Zap, title: t("electricity"), when: t("inDays", { count: 4 }), urgent: false },
    { icon: Cake, title: t("birthday"), when: t("inDays", { count: 9 }), urgent: false },
  ];
  return (
    <ul className={`${frame} space-y-2`}>
      {items.map(({ icon: Icon, title, when, urgent }) => (
        <li key={title} className="flex items-center gap-3 rounded-card px-2 py-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-body text-text">{title}</span>
          {urgent ? (
            <Badge tone="warning">
              <CalendarClock className="size-3" aria-hidden />
              {when}
            </Badge>
          ) : (
            <span className="text-caption text-muted">{when}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
