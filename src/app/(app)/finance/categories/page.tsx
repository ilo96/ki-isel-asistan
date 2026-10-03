import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryManager } from "@/features/finance/category-manager";
import { FinanceTabs } from "@/features/finance/finance-tabs";
import { financePageContext } from "@/features/finance/page-context";
import { listCategories } from "@/server/services/categories";

export const metadata: Metadata = { title: "Kategoriler" };

export default async function CategoriesPage() {
  const t = await getTranslations("categories");
  const { db, userId } = await financePageContext();
  const categories = await listCategories(db, userId, { includeArchived: true });
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <FinanceTabs />
      <CategoryManager categories={categories} />
    </>
  );
}
