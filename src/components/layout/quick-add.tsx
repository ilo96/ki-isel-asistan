"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { FormLoader } from "@/features/finance/form-loader";
import { TransactionForm } from "@/features/finance/transaction-form";
import { useQuickAddData } from "@/features/finance/use-quick-add-data";
import { useTransactionFeedback } from "@/features/finance/use-transaction-feedback";
import { ReminderForm } from "@/features/tasks/reminder-form";
import { TaskForm } from "@/features/tasks/task-form";
import { useToast } from "@/components/ui/toast";
import { CaptureBar } from "@/features/capture/capture-bar";
import type { TransactionDraft } from "@/lib/finance/draft";
import { useShell, type QuickAddKind as Kind } from "./ui-store";

/** Yazı yazılan bir alandayken kısayollar devreye girmez. */
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Her yerden ("+" ya da klavyede N) açılan Hızlı ekle sheet'i: gider, gelir,
 * hatırlatıcı (fatura ve önemli gün dahil) ya da görev.
 */
export function QuickAdd() {
  const t = useTranslations("quickAdd");
  const { overlay, open, close, quickAddKind, quickAddCapture } = useShell();
  const isOpen = overlay === "quickAdd";
  const [kind, setKind] = useState<Kind>(quickAddKind);
  // Taslak gelince form yeniden kurulur (key), böylece alanlar taslakla dolar.
  const [draft, setDraft] = useState<{ value: TransactionDraft; seq: number } | null>(null);
  const { data, failed, retry } = useQuickAddData(isOpen);
  const feedback = useTransactionFeedback();
  const tl = useTranslations("life");
  const toast = useToast();

  // Her açılışta istenen türle başla (ör. Finans'taki "Gelir ekle").
  useEffect(() => {
    if (isOpen) setKind(quickAddKind);
    else setDraft(null);
  }, [isOpen, quickAddKind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (overlay !== null || isTyping(event.target)) return;
      event.preventDefault();
      open("quickAdd");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, open]);

  const options = (["expense", "income", "reminder", "task"] as const).map((value) => ({
    value,
    label: t(value),
  }));

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => !next && close()}
      title={t("title")}
      description={t("description")}
      closeLabel={t("close")}
    >
      <SegmentedControl
        options={options}
        value={kind}
        onChange={setKind}
        label={t("description")}
        className="mb-5 flex w-full"
      />
      <FormLoader data={data} failed={failed} onRetry={retry}>
        {(loaded) =>
          kind === "reminder" ? (
            <ReminderForm
              data={loaded}
              onSaved={() => {
                close();
                toast({ message: tl("reminderAdded") });
              }}
            />
          ) : kind === "task" ? (
            <TaskForm
              today={loaded.today}
              onSaved={() => {
                close();
                toast({ message: tl("taskAdded") });
              }}
            />
          ) : (
            <>
              <CaptureBar
                receiptScan={loaded.receiptScan}
                autoStart={quickAddCapture}
                onDraft={(value) => {
                  setKind(value.type);
                  setDraft((d) => ({ value, seq: (d?.seq ?? 0) + 1 }));
                }}
              />
              <TransactionForm
                // Tür değişince form sıfırlanır: seçili kategori diğer türde geçerli değil.
                key={`${kind}-${draft?.seq ?? 0}`}
                data={loaded}
                type={kind === "income" ? "income" : "expense"}
                draft={draft?.value.type === kind ? draft.value : null}
                onSaved={(id) => {
                  close();
                  feedback.added(id, kind === "income" ? "income" : "expense");
                }}
              />
            </>
          )
        }
      </FormLoader>
    </Sheet>
  );
}
