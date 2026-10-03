import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { QuickAddButton } from "@/components/layout/quick-add-button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CurrencyCode } from "@/lib/money";
import { TransactionRow } from "@/features/finance/transaction-row";
import type { RecentTransaction } from "@/server/services/dashboard";
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
          <Link href="/finance/transactions" className="text-small text-accent hover:underline">
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
          {items.map(({ daysAgo, ...tx }) => (
            <li key={tx.id}>
              <TransactionRow
                item={tx}
                currency={currency}
                meta={dayLabel(t, daysAgo, noonOf(tx.occurredOn), "UTC", { past: true })}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
