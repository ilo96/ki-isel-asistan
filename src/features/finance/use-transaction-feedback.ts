"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { TransactionType } from "@/lib/finance/types";
import { deleteTransactionAction, restoreTransactionAction } from "./actions";

/**
 * Kaydet ve sil sonrası toast'lar. Onay penceresi yok; plan gereği her ikisi de
 * 6 saniye boyunca "Geri al" sunar (silme yumuşak olduğu için geri getirilebilir).
 */
export function useTransactionFeedback() {
  const t = useTranslations("transactionForm");
  const toast = useToast();

  const undone = useCallback(
    (ok: boolean) =>
      toast(ok ? { message: t("undone") } : { message: t("errors.unknown"), tone: "error" }),
    [t, toast],
  );

  const added = useCallback(
    (id: string, type: TransactionType) =>
      toast({
        message: t(type === "income" ? "addedIncome" : "addedExpense"),
        action: {
          label: t("undo"),
          onClick: () => void deleteTransactionAction(id).then((r) => undone(r.ok)),
        },
      }),
    [t, toast, undone],
  );

  const updated = useCallback(() => toast({ message: t("updated") }), [t, toast]);

  const remove = useCallback(
    async (id: string) => {
      const result = await deleteTransactionAction(id);
      if (!result.ok) {
        toast({ message: t("errors.unknown"), tone: "error" });
        return false;
      }
      toast({
        message: t("deleted"),
        action: {
          label: t("undo"),
          onClick: () => void restoreTransactionAction(id).then((r) => undone(r.ok)),
        },
      });
      return true;
    },
    [t, toast, undone],
  );

  return { added, updated, remove };
}
