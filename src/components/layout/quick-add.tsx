"use client";

import { Bell, CheckCircle2, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { FormLoader } from "@/features/finance/form-loader";
import { TransactionForm } from "@/features/finance/transaction-form";
import { useQuickAddData } from "@/features/finance/use-quick-add-data";
import { useTransactionFeedback } from "@/features/finance/use-transaction-feedback";
import { useShell } from "./ui-store";

type Kind = "expense" | "income" | "reminder" | "task";

const LATER: Partial<Record<Kind, LucideIcon>> = { reminder: Bell, task: CheckCircle2 };

/** Yazı yazılan bir alandayken kısayollar devreye girmez. */
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Her yerden ("+" ya da klavyede N) açılan Hızlı ekle sheet'i. Gider ve gelir formu
 * burada; hatırlatıcı ve görev formları kendi aşamalarında eklenecek.
 */
export function QuickAdd() {
  const t = useTranslations("quickAdd");
  const { overlay, open, close, quickAddKind } = useShell();
  const isOpen = overlay === "quickAdd";
  const [kind, setKind] = useState<Kind>(quickAddKind);
  const { data, failed, retry } = useQuickAddData(isOpen);
  const feedback = useTransactionFeedback();

  // Her açılışta istenen türle başla (ör. Finans'taki "Gelir ekle").
  useEffect(() => {
    if (isOpen) setKind(quickAddKind);
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
  const LaterIcon = LATER[kind];

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
      {LaterIcon ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-10 text-center">
          <LaterIcon className="mb-3 size-6 text-accent" aria-hidden />
          <p className="text-small text-muted">{t("comingSoon")}</p>
        </div>
      ) : (
        <FormLoader data={data} failed={failed} onRetry={retry}>
          {(loaded) => (
            <TransactionForm
              // Tür değişince form sıfırlanır: seçili kategori diğer türde geçerli değil.
              key={kind}
              data={loaded}
              type={kind === "income" ? "income" : "expense"}
              onSaved={(id) => {
                close();
                feedback.added(id, kind === "income" ? "income" : "expense");
              }}
            />
          )}
        </FormLoader>
      )}
    </Sheet>
  );
}
