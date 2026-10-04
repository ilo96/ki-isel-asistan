import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { FinanceTabs } from "@/features/finance/finance-tabs";
import { financePageContext } from "@/features/finance/page-context";
import { SubscriptionBoard } from "@/features/finance/subscription-board";
import { listCategories } from "@/server/services/categories";
import { getSubscriptionOverview } from "@/server/services/subscriptions";

export const metadata: Metadata = { title: "Abonelikler" };

export default async function SubscriptionsPage() {
  const t = await getTranslations("subscriptions");
  const { db, userId, currency, today } = await financePageContext();
  const [data, categories] = await Promise.all([
    getSubscriptionOverview(db, userId, today),
    listCategories(db, userId),
  ]);
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <FinanceTabs />
      <SubscriptionBoard
        data={data}
        currency={currency}
        today={today}
        categories={categories
          .filter((c) => c.type === "expense")
          .map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
}
