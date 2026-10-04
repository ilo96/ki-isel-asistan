import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { BudgetBoard } from "@/features/finance/budget-board";
import { FinanceTabs } from "@/features/finance/finance-tabs";
import { MonthSwitcher, monthLabel } from "@/features/finance/month-switcher";
import { financePageContext } from "@/features/finance/page-context";
import { getMonthBudgets } from "@/server/services/budgets";
import { listCategories } from "@/server/services/categories";

export const metadata: Metadata = { title: "Bütçeler" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BudgetsPage({ searchParams }: Props) {
  const t = await getTranslations("budgets");
  const { db, userId, currency, today, month, range } = await financePageContext(
    (await searchParams).month,
  );
  const [data, categories] = await Promise.all([
    getMonthBudgets(db, userId, range, today),
    listCategories(db, userId),
  ]);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <FinanceTabs />
      <MonthSwitcher
        month={month}
        hrefFor={(m) => `/finance/budgets?month=${m}`}
        className="mb-4"
      />
      <BudgetBoard
        data={data}
        month={month}
        monthLabel={monthLabel(month)}
        currency={currency}
        categories={categories
          .filter((c) => c.type === "expense")
          .map(({ id, name, icon, colorToken }) => ({ id, name, icon, colorToken }))}
      />
    </>
  );
}
