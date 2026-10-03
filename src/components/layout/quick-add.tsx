"use client";

import { Bell, CheckCircle2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { useShell } from "./ui-store";

type Kind = "expense" | "income" | "reminder" | "task";

const ICONS: Record<Kind, LucideIcon> = {
  expense: TrendingDown,
  income: TrendingUp,
  reminder: Bell,
  task: CheckCircle2,
};

/**
 * Her yerden açılan Hızlı ekle sheet'i. Formlar finans ve görev aşamalarında
 * (ve intercepting route ile linklenebilir hâlde) eklenecek.
 */
export function QuickAdd() {
  const t = useTranslations("quickAdd");
  const { overlay, close } = useShell();
  const [kind, setKind] = useState<Kind>("expense");
  const Icon = ICONS[kind];

  const options = (["expense", "income", "reminder", "task"] as const).map((value) => ({
    value,
    label: t(value),
  }));

  return (
    <Sheet
      open={overlay === "quickAdd"}
      onOpenChange={(next) => !next && close()}
      title={t("title")}
      description={t("description")}
      closeLabel={t("close")}
    >
      <SegmentedControl options={options} value={kind} onChange={setKind} label={t("description")} className="flex w-full" />
      <div className="mt-6 flex flex-col items-center rounded-card border border-dashed border-border px-6 py-10 text-center">
        <Icon className="mb-3 size-6 text-accent" aria-hidden />
        <p className="text-small text-muted">{t("comingSoon")}</p>
      </div>
    </Sheet>
  );
}
