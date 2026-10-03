import { ListTodo, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskTabs } from "@/features/tasks/task-tabs";

export const metadata: Metadata = { title: "Görevler" };

export default async function TasksPage() {
  const t = await getTranslations("tasks");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <TaskTabs />
      <Card className="mt-4">
        <EmptyState
          icon={ListTodo}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <QuickAddButton>
              <Plus aria-hidden />
              {t("add")}
            </QuickAddButton>
          }
        />
      </Card>
    </>
  );
}
