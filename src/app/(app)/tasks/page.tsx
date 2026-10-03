import { CalendarCheck2, ListTodo, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LifeList } from "@/features/tasks/life-list";
import { TaskTabs } from "@/features/tasks/task-tabs";
import { dayIn, DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/money";
import { LIFE_TABS, type LifeTab } from "@/lib/validation/life";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { getLifeCounts, getLifeItems } from "@/server/services/life-overview";

export const metadata: Metadata = { title: "Görevler" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const EMPTY_ICON = { today: Sparkles, upcoming: CalendarCheck2, done: ListTodo } as const;

export default async function TasksPage({ searchParams }: Props) {
  const t = await getTranslations("life");
  const requested = (await searchParams).tab;
  const tab: LifeTab = LIFE_TABS.find((k) => k === requested) ?? "today";
  const user = await requireUser();
  const timezone = user.timezone ?? DEFAULT_TIMEZONE;
  const db = await getDb();
  const now = new Date();
  const [items, counts] = await Promise.all([
    getLifeItems(db, { id: user.id, timezone }, tab, now),
    getLifeCounts(db, { id: user.id, timezone }, now),
  ]);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <QuickAddButton kind="task" className="hidden sm:inline-flex">
            <Plus aria-hidden />
            {t("addTask")}
          </QuickAddButton>
        }
      />
      <TaskTabs tab={tab} counts={counts} />
      <Card className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={EMPTY_ICON[tab]}
            title={t(`empty.${tab}.title`)}
            description={t(`empty.${tab}.body`)}
            action={
              tab !== "done" && (
                <div className="flex flex-wrap justify-center gap-2">
                  <QuickAddButton kind="task">
                    <Plus aria-hidden />
                    {t("addTask")}
                  </QuickAddButton>
                  <QuickAddButton kind="reminder" variant="soft">
                    {t("addReminder")}
                  </QuickAddButton>
                </div>
              )
            }
            hint={tab !== "done" ? t("orSay") : undefined}
          />
        ) : (
          <LifeList
            items={items}
            tab={tab}
            today={dayIn(now, timezone)}
            currency={(user.currency ?? DEFAULT_CURRENCY) as CurrencyCode}
          />
        )}
      </Card>
    </>
  );
}
