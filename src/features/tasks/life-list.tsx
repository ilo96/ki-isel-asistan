"use client";

import {
  Bell,
  CalendarHeart,
  Flag,
  ListTodo,
  Receipt,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useShell } from "@/components/layout/ui-store";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { DateString } from "@/lib/dates";
import type { LifeItem } from "@/lib/life/types";
import { duration, ease, spring } from "@/lib/motion";
import type { CurrencyCode } from "@/lib/money";
import type { LifeTab } from "@/lib/validation/life";
import { lifeMeta, relativeDay } from "./life-meta";
import { useLifeFeedback } from "./use-life-feedback";

const KIND_ICON: Record<string, LucideIcon> = {
  task: ListTodo,
  reminder: Bell,
  bill: Receipt,
  important_date: CalendarHeart,
};

type Props = { items: LifeItem[]; tab: LifeTab; today: DateString; currency: CurrencyCode };

type Group = { key: string; label: string; items: LifeItem[] };

function groupItems(
  items: LifeItem[],
  tab: LifeTab,
  today: DateString,
  t: ReturnType<typeof useTranslations<"life">>,
): Group[] {
  if (tab === "done") return [{ key: "done", label: "", items }];
  if (tab === "today") {
    const groups: Group[] = [
      { key: "overdue", label: t("groups.overdue"), items: items.filter((i) => i.overdue) },
      {
        key: "today",
        label: t("groups.today"),
        items: items.filter((i) => !i.overdue && i.date !== null),
      },
      {
        key: "someday",
        label: t("groups.someday"),
        items: items.filter((i) => !i.overdue && i.date === null),
      },
    ];
    return groups.filter((g) => g.items.length > 0);
  }
  const groups: Group[] = [];
  for (const item of items) {
    const key = item.date ?? "none";
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: relativeDay(t, key, today, { long: true }), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Görevler ekranının listesi; günlere ya da duruma göre gruplu. */
export function LifeList({ items, tab, today, currency }: Props) {
  const t = useTranslations("life");
  const groups = groupItems(items, tab, today, t);
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label || t("tabs.done")}>
          {group.label && (
            <h2
              className={cn(
                "mb-1.5 px-2 text-small first-letter:uppercase",
                group.key === "overdue" ? "text-negative" : "text-muted",
              )}
            >
              {group.label}
              <span className="ml-1.5 text-muted">· {group.items.length}</span>
            </h2>
          )}
          <ul className="-mx-2">
            <AnimatePresence initial={false}>
              {group.items.map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, transition: { duration: duration.fade } }}
                  transition={spring.layout}
                >
                  <LifeRow item={item} today={today} currency={currency} tab={tab} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}

function LifeRow({
  item,
  today,
  currency,
  tab,
}: {
  item: LifeItem;
  today: DateString;
  currency: CurrencyCode;
  tab: LifeTab;
}) {
  const done = tab === "done";
  const t = useTranslations("life");
  const { editLife } = useShell();
  const feedback = useLifeFeedback();
  const reduce = useReducedMotion();
  const [checked, setChecked] = useState(done);
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICON[item.type === "task" ? "task" : item.kind] ?? Bell;
  // Yaklaşan'da gün grup başlığında; Bugün'de yalnızca gecikmişlerin günü ("Dün") yazılır.
  const meta = lifeMeta(t, item, today, { showDate: tab === "today" });
  // Tekrarlayan hatırlatıcıların tamamlanmış kopyaları yeniden açılmaz; geri al toast'ı kullanılır.
  const canReopen = done && item.type === "task";

  const toggle = async () => {
    if (busy || (done && !canReopen)) return;
    setBusy(true);
    setChecked(!checked);
    const ok = done ? await feedback.reopen(item) : await feedback.complete(item);
    if (!ok) setChecked(done);
    setBusy(false);
  };

  const label = t(done ? "reopenLabel" : "completeLabel", { title: item.title });

  return (
    <div className="flex min-h-14 items-center gap-1 rounded-input pr-2 transition-colors hover:bg-surface-muted">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || (done && !canReopen)}
        aria-label={label}
        aria-pressed={checked}
        className="grid size-11 shrink-0 place-items-center rounded-full disabled:cursor-default"
      >
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full border-2 transition-colors duration-[180ms]",
            checked
              ? "border-positive bg-positive text-on-accent"
              : item.overdue
                ? "border-negative/60"
                : "border-border hover:border-accent",
          )}
        >
          {checked && (
            <motion.svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: done || reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: duration.page, ease }}
              />
            </motion.svg>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={() => editLife(item)}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1.5 text-body",
              checked ? "text-muted line-through decoration-muted/60" : "text-text",
            )}
          >
            <Icon className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{item.title}</span>
            {item.priority === "high" && !checked && (
              <Flag className="size-3.5 shrink-0 text-warning" aria-label={t("priority.high")} />
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-small text-muted">
            {item.overdue && !checked && <Badge tone="negative">{t("overdue")}</Badge>}
            {item.type === "reminder" && item.repeat && (
              <Repeat className="size-3.5 shrink-0" aria-hidden />
            )}
            <span className="truncate">
              {done && item.completedAt
                ? t("completedAt", { when: completedLabel(item.completedAt) })
                : meta}
            </span>
          </span>
        </span>
        {item.type === "reminder" && item.amountMinor !== null && (
          <Amount
            minor={item.amountMinor}
            currency={currency}
            compact
            className="text-body text-text"
          />
        )}
        {item.type === "reminder" && item.kind === "bill" && !checked && !done && (
          <span className="sr-only">{t("checkToPay")}</span>
        )}
      </button>
    </div>
  );
}

function completedLabel(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
