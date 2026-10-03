"use client";

import { Activity, Bell, CalendarClock, PiggyBank, Receipt, Sparkles, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { markReadAction } from "./actions";

export type NotificationRow = {
  id: string;
  kind: "bill_due" | "reminder_due" | "budget_threshold" | "weekly_summary" | "fitness";
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  /** Kullanıcının saatine göre hazır metin: "Bugün 09:15" ya da "3 Eki". */
  when: string;
  today: boolean;
};

const ICONS: Record<NotificationRow["kind"], { icon: LucideIcon; tone: string }> = {
  bill_due: { icon: Receipt, tone: "bg-warning-soft text-warning" },
  reminder_due: { icon: CalendarClock, tone: "bg-accent-soft text-accent" },
  budget_threshold: { icon: PiggyBank, tone: "bg-negative-soft text-negative" },
  weekly_summary: { icon: Sparkles, tone: "ai-gradient text-white" },
  fitness: { icon: Activity, tone: "bg-positive-soft text-positive" },
};

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const t = useTranslations("notificationsPage");
  const router = useRouter();
  const [, start] = useTransition();
  const [rows, setRead] = useOptimistic(items, (state, id: string) =>
    state.map((n) => (id === "all" || n.id === id ? { ...n, read: true } : n)),
  );
  const unread = rows.some((n) => !n.read);

  const open = (n: NotificationRow) =>
    start(async () => {
      if (!n.read) {
        setRead(n.id);
        await markReadAction(n.id);
      }
      if (n.href) router.push(n.href);
    });

  const groups = [
    { label: t("today"), rows: rows.filter((n) => n.today) },
    { label: t("earlier"), rows: rows.filter((n) => !n.today) },
  ].filter((g) => g.rows.length);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
          <Bell className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-h2 text-text">{t("emptyTitle")}</h2>
        <p className="mt-1 max-w-sm text-body text-muted">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {unread && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              start(async () => {
                setRead("all");
                await markReadAction("all");
              })
            }
          >
            {t("markAll")}
          </Button>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="mb-2 px-1 text-caption text-muted">{g.label}</h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-card border border-border/60 bg-surface shadow-card dark:border-transparent">
            {g.rows.map((n) => {
              const { icon: Icon, tone } = ICONS[n.kind];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5", tone)}>
                      <Icon aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-body text-text", !n.read && "font-medium")}>{n.title}</span>
                      <span className="block text-small text-muted">{n.body}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-caption text-muted tabular-nums">{n.when}</span>
                      {!n.read && (
                        <span className="size-2 rounded-full bg-accent" role="img" aria-label={t("unread")} />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
