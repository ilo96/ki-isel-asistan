import { Plus, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Finans" };

export default async function FinancePage() {
  const t = await getTranslations("finance");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Card>
        <EmptyState
          icon={ReceiptText}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <QuickAddButton>
              <Plus aria-hidden />
              {t("addExpense")}
            </QuickAddButton>
          }
          hint={t("orSay")}
        />
      </Card>
    </>
  );
}
