import { CalendarClock, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AssistantOrb } from "@/components/assistant/assistant-orb";
import { Amount } from "@/components/ui/amount";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Greeting } from "@/features/dashboard/greeting";
import { StatCard } from "@/features/dashboard/stat-card";

export const metadata: Metadata = { title: "Ana Sayfa" };

export default async function HomePage() {
  const t = await getTranslations("home");
  // Faz 1: veri katmanı yok; tüm rakamlar sıfır ve boş durumlar gösterilir.
  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="pt-2">
        <Greeting />
        <div className="relative mt-4 overflow-hidden rounded-card border border-border/60 bg-surface p-5 shadow-card dark:border-transparent">
          <div className="ai-gradient absolute inset-y-0 left-0 w-1" aria-hidden />
          <div className="flex items-start gap-4">
            <AssistantOrb size="md" />
            <div>
              <p className="text-caption text-muted">{t("summaryLabel")}</p>
              <p className="mt-1 text-body text-text">{t("summaryEmpty")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label={t("balance")}>
        <StatCard index={0} label={t("balance")} icon={<Wallet />}>
          <Amount minor={0} animated compact />
        </StatCard>
        <StatCard index={1} label={t("income")} icon={<TrendingUp />}>
          <Amount minor={0} animated compact />
        </StatCard>
        <StatCard index={2} label={t("expense")} icon={<TrendingDown />}>
          <Amount minor={0} animated compact />
        </StatCard>
        <StatCard
          index={3}
          label={t("budgetLeft")}
          icon={<PiggyBank />}
          footer={<p className="text-caption text-muted">{t("noBudget")}</p>}
        >
          <Amount minor={0} animated compact />
        </StatCard>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("upcoming")}</CardTitle>
        </CardHeader>
        <EmptyState
          icon={CalendarClock}
          title={t("upcomingEmptyTitle")}
          description={t("upcomingEmptyBody")}
          action={<QuickAddButton variant="soft">{t("addReminder")}</QuickAddButton>}
          hint={t("orSay")}
        />
      </Card>
    </div>
  );
}
