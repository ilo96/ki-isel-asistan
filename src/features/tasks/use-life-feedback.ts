"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import type { LifeItem } from "@/lib/life/types";
import {
  completeAction,
  deleteLifeAction,
  recordBillAction,
  reopenAction,
  restoreLifeAction,
  undoBillExpenseAction,
  undoCompleteAction,
} from "./actions";

/** "12 Kas" gibi kısa tarih; tekrarlayan hatırlatıcının sonraki tarihi için. */
function shortDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(iso));
}

/**
 * Tamamla, sil ve fatura ödemesi sonrası toast'lar. Onay penceresi yok; her biri geri alınabilir.
 * Fatura ödenince toast tek dokunuşla aynı tutarda gider eklemeyi önerir (plan: Hatırlatıcıdan ödemeye).
 */
export function useLifeFeedback() {
  const t = useTranslations("life");
  const toast = useToast();

  const failed = useCallback(
    () => toast({ message: t("errors.unknown"), tone: "error" }),
    [t, toast],
  );
  const undone = useCallback(
    (ok: boolean) => (ok ? toast({ message: t("undone") }) : failed()),
    [t, toast, failed],
  );

  const complete = useCallback(
    async (item: LifeItem) => {
      const result = await completeAction({ type: item.type, id: item.id });
      if (!result.ok) {
        failed();
        return false;
      }
      const data = result.data;
      if (data.type === "reminder" && data.billable) {
        toast({
          message: t("billPaid", { title: item.title }),
          durationMs: 8000,
          action: {
            label: t("addAsExpense"),
            onClick: () =>
              void recordBillAction(data.id, data.copyId).then((r) => {
                if (!r.ok) return failed();
                toast({
                  message: t("expenseAdded"),
                  action: {
                    label: t("undo"),
                    onClick: () => void undoBillExpenseAction(r.data.id).then((u) => undone(u.ok)),
                  },
                });
              }),
          },
        });
        return true;
      }
      toast({
        message:
          data.type === "reminder" && data.nextDueAt
            ? t("completedNext", { date: shortDate(data.nextDueAt) })
            : t(item.type === "task" ? "taskDone" : "reminderDone"),
        action: {
          label: t("undo"),
          onClick: () => void undoCompleteAction(data).then((r) => undone(r.ok)),
        },
      });
      return true;
    },
    [t, toast, failed, undone],
  );

  const reopen = useCallback(
    async (item: LifeItem) => {
      const result = await reopenAction({ type: item.type, id: item.id });
      if (!result.ok) failed();
      return result.ok;
    },
    [failed],
  );

  const remove = useCallback(
    async (item: LifeItem) => {
      const ref = { type: item.type, id: item.id };
      const result = await deleteLifeAction(ref);
      if (!result.ok) {
        failed();
        return false;
      }
      toast({
        message: t("deleted"),
        action: {
          label: t("undo"),
          onClick: () => void restoreLifeAction(ref).then((r) => undone(r.ok)),
        },
      });
      return true;
    },
    [t, toast, failed, undone],
  );

  return { complete, reopen, remove };
}
