import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Amount } from "@/components/ui/amount";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CurrencyCode } from "@/lib/money";
import type { RecentTransaction } from "@/server/services/dashboard";
import { CategoryIcon } from "./category-icon";
import { dayLabel, noonOf } from "./day-label";

type Props = { items: RecentTransaction[]; currency: CurrencyCode };

/** Son beş işlem, en yenisi üstte. */
export async function RecentTransactions({ items, currency }: Props) {
  const t = await getTranslations("home");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("recent")}</CardTitle>
        {items.length > 0 && (
          <Link href="/finance" className="text-small text-accent hover:underline">
            {t("seeAll")}
          </Link>
        )}
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={t("recentEmptyTitle")}
          description={t("recentEmptyBody")}
          action={<QuickAddButton variant="soft">{t("addExpense")}</QuickAddButton>}
          hint={t("orSayExpense")}
        />
      ) : (
        <ul className="-mx-2">
          {items.map((tx) => (
            <li key={tx.id} className="flex min-h-14 items-center gap-3 rounded-input px-2 py-2">
              <CategoryIcon icon={tx.category.icon} colorToken={tx.category.colorToken} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-text">{tx.description}</p>
                <p className="truncate text-small text-muted">
                  {tx.category.name} ·{" "}
                  {dayLabel(t, tx.daysAgo, noonOf(tx.occurredOn), "UTC", { past: true })}
                </p>
              </div>
              <Amount
                minor={tx.amountMinor}
                currency={currency}
                kind={tx.type}
                className="text-body"
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
