import { Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DayGroups } from "@/features/finance/day-groups";
import { FinanceTabs } from "@/features/finance/finance-tabs";
import { MonthSwitcher } from "@/features/finance/month-switcher";
import { financePageContext } from "@/features/finance/page-context";
import { TransactionFilters } from "@/features/finance/transaction-filters";
import { transactionFilterSchema } from "@/lib/validation/finance";
import { listCategories } from "@/server/services/categories";
import { DEFAULT_PAGE_SIZE, listTransactions } from "@/server/services/transactions";

export const metadata: Metadata = { title: "İşlemler" };

const MAX_LIMIT = 500;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TransactionsPage({ searchParams }: Props) {
  const t = await getTranslations("finance");
  const params = await searchParams;
  const { db, userId, currency, today, month, range } = await financePageContext(params.month);
  const filter = transactionFilterSchema.parse({
    type: params.type,
    categoryId: params.categoryId,
    q: params.q || undefined,
  });
  const limit = Math.min(Math.max(Number(params.limit) || DEFAULT_PAGE_SIZE, 1), MAX_LIMIT);

  const [categories, { items, hasMore }] = await Promise.all([
    listCategories(db, userId, { includeArchived: true }),
    listTransactions(db, userId, { ...range, ...filter, limit }),
  ]);

  const query = (extra: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filter, month, ...extra })) {
      if (value) next.set(key, String(value));
    }
    return `/finance/transactions?${next.toString()}`;
  };
  const filtered = Boolean(filter.type || filter.categoryId || filter.q);
  const net = items.reduce(
    (sum, i) => sum + (i.type === "income" ? i.amountMinor : -i.amountMinor),
    0,
  );

  return (
    <>
      <PageHeader
        title={t("transactionsTitle")}
        subtitle={t("transactionsSubtitle")}
        action={
          <QuickAddButton className="hidden sm:inline-flex">
            <Plus aria-hidden />
            {t("addTransaction")}
          </QuickAddButton>
        }
      />
      <FinanceTabs />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher month={month} hrefFor={(m) => query({ month: m })} />
        {items.length > 0 && !hasMore && (
          <p className="text-small text-muted">
            {t("countAndNet", { count: items.length })}{" "}
            <Amount
              minor={Math.abs(net)}
              currency={currency}
              kind={net < 0 ? "expense" : "income"}
            />
          </p>
        )}
      </div>

      <Card>
        <Suspense>
          <TransactionFilters
            categories={categories
              .filter((c) => !c.archived || c.id === filter.categoryId)
              .map(({ id, name, type }) => ({ id, name, type }))}
          />
        </Suspense>
        <div className="mt-5">
          {items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t(filtered ? "noResultsTitle" : "noTransactionsThisMonth")}
              description={t(filtered ? "noResultsBody" : "emptyMonthBody")}
              action={
                filtered ? (
                  <Button asChild variant="soft">
                    <Link href={`/finance/transactions?month=${month}`}>{t("clearFilters")}</Link>
                  </Button>
                ) : (
                  <QuickAddButton variant="soft">{t("addTransaction")}</QuickAddButton>
                )
              }
            />
          ) : (
            <DayGroups items={items} currency={currency} today={today} />
          )}
        </div>
        {hasMore && (
          <div className="mt-5 flex justify-center">
            <Button asChild variant="secondary">
              <Link
                href={query({ limit: String(Math.min(limit + DEFAULT_PAGE_SIZE, MAX_LIMIT)) })}
                scroll={false}
              >
                {t("showMore")}
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
