"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { FormAlert } from "@/features/auth/form-alert";
import { CategoryIcon } from "@/features/dashboard/category-icon";
import { cn } from "@/lib/cn";
import type { MonthKey } from "@/lib/dates";
import { formatMoney, parseMoneyInput, type CurrencyCode } from "@/lib/money";
import { MAX_AMOUNT_MINOR } from "@/lib/validation/finance";
import type { BudgetLine } from "@/server/services/budgets";
import type { BudgetCategory } from "./budget-board";
import { removeBudgetAction, saveBudgetAction } from "./budget-actions";
import { MoneyInput } from "./money-input";

export type BudgetTarget =
  | { kind: "overall"; existing: BudgetLine | null }
  | { kind: "category"; existing: BudgetLine | null; categoryId?: string };

type Props = {
  target: BudgetTarget | null;
  onClose: () => void;
  month: MonthKey;
  monthLabel: string;
  currency: CurrencyCode;
  /** Henüz bütçesi olmayan gider kategorileri. */
  categories: BudgetCategory[];
  suggestions: Record<string, number>;
  overallSuggestionMinor: number;
};

const toInput = (minor: number) => formatMoney(minor, { compact: true }).replace(/[^\d.,]/g, "");

/** Bütçe ekle/düzenle sheet'i. Kayıt seçili aydan itibaren geçerlidir; kaldırma geri alınabilir. */
export function BudgetSheet(props: Props) {
  const t = useTranslations("budgets");
  const { target, onClose } = props;
  const title = !target
    ? ""
    : target.kind === "overall"
      ? t(target.existing ? "editOverall" : "setOverall")
      : target.existing
        ? t("editCategory", { name: target.existing.name ?? "" })
        : t("addCategory");
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      closeLabel={t("close")}
    >
      {target && <BudgetForm key={JSON.stringify(target)} {...props} target={target} />}
    </Sheet>
  );
}

function BudgetForm({
  target,
  onClose,
  month,
  monthLabel,
  currency,
  categories,
  suggestions,
  overallSuggestionMinor,
}: Props & { target: BudgetTarget }) {
  const t = useTranslations("budgets");
  const tv = useTranslations("validation");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const existing = target.existing;
  const [categoryId, setCategoryId] = useState<string | null>(
    target.kind === "overall"
      ? null
      : (existing?.categoryId ?? (target.categoryId || categories[0]?.id) ?? null),
  );
  const [amount, setAmount] = useState(existing ? toInput(existing.limitMinor) : "");

  const suggestion =
    target.kind === "overall"
      ? overallSuggestionMinor
      : categoryId
        ? (suggestions[categoryId] ?? 0)
        : 0;

  useEffect(() => setError(null), [amount, categoryId]);

  const save = () => {
    const minor = parseMoneyInput(amount);
    if (minor === null) return setError(tv("amount"));
    if (minor <= 0) return setError(tv("amountPositive"));
    if (minor > MAX_AMOUNT_MINOR) return setError(tv("amountMax"));
    if (target.kind === "category" && !categoryId) return setError(tv("categoryRequired"));
    startTransition(async () => {
      const result = await saveBudgetAction({ categoryId, amountMinor: minor, month });
      if (!result.ok) return setError(t("errors.unknown"));
      onClose();
      toast({ message: t(existing ? "updated" : "saved") });
    });
  };

  const remove = () => {
    if (!existing) return;
    startTransition(async () => {
      const result = await removeBudgetAction(existing.categoryId, month);
      if (!result.ok) return setError(t("errors.unknown"));
      onClose();
      toast({
        message: t("removed"),
        action: {
          label: t("undo"),
          onClick: () =>
            void saveBudgetAction({
              categoryId: existing.categoryId,
              amountMinor: existing.limitMinor,
              month,
            }),
        },
      });
    });
  };

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {error && <FormAlert>{error}</FormAlert>}

      {target.kind === "category" && !existing && (
        <fieldset>
          <legend className="mb-2 text-small text-text">{t("category")}</legend>
          <div role="radiogroup" aria-label={t("category")} className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1 text-small transition-colors duration-[120ms]",
                    active
                      ? "border-accent bg-accent-soft text-text"
                      : "border-border bg-surface text-text hover:border-accent/40",
                  )}
                >
                  <CategoryIcon icon={c.icon} colorToken={c.colorToken} className="size-8" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="budget-amount" className="mb-2 block text-small text-text">
          {t("monthlyLimit")}
        </label>
        <MoneyInput
          id="budget-amount"
          currency={currency}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        {suggestion > 0 && (
          <button
            type="button"
            onClick={() => setAmount(toInput(suggestion))}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-small text-accent"
          >
            <Sparkles className="size-3.5" aria-hidden />
            {t("useSuggestion", { amount: formatMoney(suggestion, { currency, compact: true }) })}
          </button>
        )}
        <p className="mt-2 text-caption text-muted first-letter:uppercase">
          {t("appliesFrom", { month: monthLabel })}
        </p>
      </div>

      <div className="flex gap-3">
        {existing && (
          <Button type="button" variant="danger" size="lg" onClick={remove} disabled={pending}>
            <Trash2 aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("remove")}</span>
          </Button>
        )}
        <Button type="submit" size="lg" block loading={pending} className="flex-1">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
