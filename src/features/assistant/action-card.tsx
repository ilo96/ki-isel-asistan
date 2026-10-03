"use client";

import {
  ArrowUpRight,
  Bell,
  Brain,
  CheckSquare,
  ListChecks,
  Navigation,
  PiggyBank,
  Receipt,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionState, CardIcon, MessagePart } from "@/lib/assistant/types";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import {
  confirmAssistantAction,
  rejectAssistantAction,
  undoAssistantAction,
} from "./actions";

const ICONS: Record<CardIcon, LucideIcon> = {
  expense: TrendingDown,
  income: TrendingUp,
  reminder: Bell,
  bill: Receipt,
  task: CheckSquare,
  summary: Sparkles,
  budget: PiggyBank,
  balance: Wallet,
  list: ListChecks,
  memory: Brain,
  delete: Trash2,
  navigate: Navigation,
};

const TONE: Record<CardIcon, string> = {
  expense: "bg-negative-soft text-negative",
  income: "bg-positive-soft text-positive",
  reminder: "bg-accent-soft text-accent",
  bill: "bg-warning-soft text-warning",
  task: "bg-accent-soft text-accent",
  summary: "ai-gradient text-white",
  budget: "bg-accent-soft text-accent",
  balance: "bg-accent-soft text-accent",
  list: "bg-surface-muted text-muted",
  memory: "ai-gradient text-white",
  delete: "bg-negative-soft text-negative",
  navigate: "bg-surface-muted text-muted",
};

const BADGE: Record<ActionState, "accent" | "positive" | "neutral" | "warning" | "negative"> = {
  proposed: "warning",
  executed: "positive",
  rejected: "neutral",
  undone: "neutral",
  expired: "neutral",
  failed: "negative",
};

type ActionPart = Extract<MessagePart, { type: "action" }>;

/**
 * Asistanın yaptığı ya da önerdiği işin kartı (plan: ToolRunCard ve ConfirmCard).
 * Önerilen işler burada onaylanır; yapılanlar geri alınabilir.
 */
export function ActionCardView({
  part,
  onChange,
}: {
  part: ActionPart;
  onChange: (patch: Partial<ActionPart>) => void;
}) {
  const t = useTranslations("assistantPage");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"confirm" | "reject" | "undo" | null>(null);
  const Icon = ICONS[part.card.icon];
  // Okuma kartları (özet, bütçe) durum rozeti taşımaz.
  const isRead = part.actionId === null;

  const act = (kind: "confirm" | "reject" | "undo") => {
    if (!part.actionId) return;
    const actionId = part.actionId;
    setBusy(kind);
    start(async () => {
      if (kind === "confirm") {
        const r = await confirmAssistantAction(actionId);
        if (r.ok) {
          onChange({ state: "executed", undoable: r.data.undoable, ...(r.data.card ? { card: r.data.card } : {}) });
        } else {
          if (r.error === "expired" || r.error === "not_found") onChange({ state: "expired" });
          toast({ message: t(`errors.${r.error === "expired" ? "expired" : "unknown"}`), tone: "error" });
        }
      } else if (kind === "reject") {
        const r = await rejectAssistantAction(actionId);
        if (r.ok) onChange({ state: "rejected" });
      } else {
        const r = await undoAssistantAction(actionId);
        if (r.ok) {
          onChange({ state: "undone", undoable: false });
          toast({ message: t("undone") });
        } else {
          toast({ message: t("errors.unknown"), tone: "error" });
        }
      }
      setBusy(null);
    });
  };

  const muted = part.state === "rejected" || part.state === "undone" || part.state === "expired";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring.layout}
      className={cn(
        "w-full max-w-sm rounded-card border bg-surface p-4 shadow-card",
        part.state === "proposed" ? "border-warning/40" : "border-border/70 dark:border-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5", TONE[part.card.icon], muted && "opacity-50")}>
          <Icon aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {!isRead && (
            <Badge tone={BADGE[part.state]} className="mb-1.5">
              {t(`states.${part.state}`)}
            </Badge>
          )}
          <p className={cn("text-body font-medium text-text tabular-nums", muted && "text-muted line-through decoration-1")}>
            {part.card.title}
          </p>
          {part.card.lines.map((line) => (
            <p key={line} className="text-small text-muted tabular-nums">
              {line}
            </p>
          ))}
        </div>
        {part.card.href && part.state === "executed" && (
          <Link
            href={part.card.href}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-text"
            aria-label={t("open")}
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>

      {part.state === "proposed" && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" loading={pending && busy === "confirm"} disabled={pending} onClick={() => act("confirm")}>
            {t("confirm")}
          </Button>
          <Button size="sm" variant="ghost" className="flex-1" loading={pending && busy === "reject"} disabled={pending} onClick={() => act("reject")}>
            {t("reject")}
          </Button>
        </div>
      )}
      {part.state === "executed" && part.undoable && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <Button size="sm" variant="ghost" className="-ml-2" loading={pending && busy === "undo"} disabled={pending} onClick={() => act("undo")}>
            {t("undo")}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
