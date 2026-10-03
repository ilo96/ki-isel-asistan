"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useShell } from "@/components/layout/ui-store";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import type { TransactionItem, TransactionType } from "@/lib/finance/types";
import { FormLoader } from "./form-loader";
import { TransactionForm } from "./transaction-form";
import { useQuickAddData } from "./use-quick-add-data";
import { useTransactionFeedback } from "./use-transaction-feedback";

/** Bir işleme dokununca açılan düzenleme sheet'i; silme de buradan, onaysız ve geri alınabilir. */
export function EditTransactionSheet() {
  const t = useTranslations("transactionForm");
  const { overlay, close, editing } = useShell();
  return (
    <Sheet
      open={overlay === "editTransaction" && editing !== null}
      onOpenChange={(next) => !next && close()}
      title={t("editTitle")}
      closeLabel={t("close")}
    >
      {editing && <EditBody key={editing.id} transaction={editing} onClose={close} />}
    </Sheet>
  );
}

function EditBody({ transaction, onClose }: { transaction: TransactionItem; onClose: () => void }) {
  const t = useTranslations("transactionForm");
  const tq = useTranslations("quickAdd");
  const [type, setType] = useState<TransactionType>(transaction.type);
  const { data, failed, retry } = useQuickAddData(true);
  const feedback = useTransactionFeedback();

  const options = (["expense", "income"] as const).map((value) => ({ value, label: tq(value) }));

  return (
    <>
      <SegmentedControl
        options={options}
        value={type}
        onChange={setType}
        label={t("type")}
        className="mb-5 flex w-full"
      />
      <FormLoader data={data} failed={failed} onRetry={retry}>
        {(loaded) => (
          <TransactionForm
            key={type}
            data={loaded}
            type={type}
            initial={
              type === transaction.type
                ? transaction
                : { ...transaction, category: { ...transaction.category, id: "" } }
            }
            onSaved={() => {
              onClose();
              feedback.updated();
            }}
            onDelete={async () => {
              if (await feedback.remove(transaction.id)) onClose();
            }}
          />
        )}
      </FormLoader>
    </>
  );
}
