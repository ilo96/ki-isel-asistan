"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ChevronDown, Mic, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/features/auth/form-alert";
import { useValidationMessage } from "@/features/auth/use-auth-error";
import { cn } from "@/lib/cn";
import type { TransactionDraft } from "@/lib/finance/draft";
import type { CategoryOption, TransactionItem, TransactionType } from "@/lib/finance/types";
import { fadeTransition } from "@/lib/motion";
import { formatMoney, parseMoneyInput, type CurrencyCode } from "@/lib/money";
import { MAX_AMOUNT_MINOR, transactionInputSchema } from "@/lib/validation/finance";
import { CategoryIcon } from "@/features/dashboard/category-icon";
import type { ActionError, QuickAddData } from "./actions";
import { saveTransactionAction } from "./actions";

const SYMBOLS: Record<CurrencyCode, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };
/** Plan: en çok kullanılan 6 kategori üstte, gerisi "Tümü" altında. */
const TOP_CATEGORIES = 6;

const formSchema = transactionInputSchema.omit({ amountMinor: true, type: true }).extend({
  amount: z
    .string()
    .trim()
    .min(1, "amount")
    .refine((v) => parseMoneyInput(v) !== null, "amount")
    .refine((v) => (parseMoneyInput(v) ?? 0) > 0, "amountPositive")
    .refine((v) => (parseMoneyInput(v) ?? 0) <= MAX_AMOUNT_MINOR, "amountMax"),
  categoryId: z.string().min(1, "categoryRequired"),
});

type FormValues = z.input<typeof formSchema>;

/** Kuruşu formdaki metne çevirir: 1234550 → "12.345,50" */
function toInput(minor: number) {
  return formatMoney(minor, { compact: true }).replace(/[^\d.,]/g, "");
}

/** Kullanım sıklığına göre sıralı, seçili kategori her zaman görünür. */
function orderCategories(all: CategoryOption[], type: TransactionType, selected?: string) {
  return all
    .filter((c) => c.type === type && (!c.archived || c.id === selected))
    .map((c, index) => ({ c, index }))
    .sort((a, b) => b.c.usage - a.c.usage || a.index - b.index)
    .map(({ c }) => c);
}

type Props = {
  data: QuickAddData;
  type: TransactionType;
  initial?: TransactionItem;
  /** Sesle ya da fişten gelen taslak; form onunla dolu açılır. */
  draft?: TransactionDraft | null;
  onSaved: (id: string) => void;
  onDelete?: () => void;
};

/**
 * Gider/gelir formu. Hızlı ekle ve düzenleme aynı formu kullanır: tutar odaklı açılır,
 * kategori chip'le seçilir; açıklama, tarih ve not "Daha fazla" altında katlıdır.
 */
export function TransactionForm({ data, type, initial, draft, onSaved, onDelete }: Props) {
  const t = useTranslations("transactionForm");
  const v = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<ActionError | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [more, setMore] = useState(
    Boolean(initial?.note) || Boolean(draft && (draft.description || draft.occurredOn !== data.today)),
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: initial ? toInput(initial.amountMinor) : draft?.amountMinor ? toInput(draft.amountMinor) : "",
      categoryId: initial?.category.id ?? draft?.categoryId ?? "",
      // Açıklama kategori adından türediyse boş gelir; kategori değişince yeni adı alır.
      description:
        initial && initial.description !== initial.category.name ? initial.description : (draft?.description ?? ""),
      note: initial?.note ?? "",
      occurredOn: initial?.occurredOn ?? draft?.occurredOn ?? data.today,
    },
  });

  const selectedId = watch("categoryId");
  // Alan yazılan kadar genişler; para birimi simgesi rakamın hemen solunda kalır.
  const amountWidth = `${Math.min(Math.max(watch("amount").length, 1), 14) + 0.5}ch`;
  const ordered = useMemo(
    () => orderCategories(data.categories, type, initial?.category.id),
    [data.categories, type, initial?.category.id],
  );
  const selectedIndex = ordered.findIndex((c) => c.id === selectedId);
  const visible =
    showAll || ordered.length <= TOP_CATEGORIES + 1
      ? ordered
      : selectedIndex >= TOP_CATEGORIES
        ? [...ordered.slice(0, TOP_CATEGORIES - 1), ordered[selectedIndex]!]
        : ordered.slice(0, TOP_CATEGORIES);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveTransactionAction(initial?.id ?? null, {
        type,
        amountMinor: parseMoneyInput(values.amount)!,
        categoryId: values.categoryId,
        description: values.description,
        note: values.note ?? "",
        occurredOn: values.occurredOn,
      });
      if (result.ok) onSaved(result.data.id);
      else setServerError(result.error);
    });
  });

  const amountError = v(errors.amount?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {draft && (
        <p className="flex items-start gap-2 rounded-input bg-accent-soft px-3.5 py-2.5 text-small text-text" role="status">
          {draft.source === "voice" ? (
            <Mic className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          ) : (
            <Camera className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          )}
          <span>
            {draft.source === "voice" && draft.heard ? t("draftHeard", { text: draft.heard }) : t("draftReceipt")}{" "}
            <span className="text-muted">{t("draftCheck")}</span>
          </span>
        </p>
      )}
      {serverError && (
        <FormAlert>
          {t.has(`errors.${serverError}`) ? t(`errors.${serverError}`) : t("errors.unknown")}
        </FormAlert>
      )}

      <div>
        <label htmlFor="tx-amount" className="sr-only">
          {t("amount")}
        </label>
        <div
          className={cn(
            "flex items-baseline justify-center gap-1 overflow-hidden rounded-card bg-surface-muted px-4 py-5",
            type === "income" ? "text-positive" : "text-text",
          )}
        >
          <span aria-hidden className="text-h1 text-muted">
            {SYMBOLS[data.currency]}
          </span>
          <input
            id="tx-amount"
            {...register("amount")}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? "tx-amount-error" : undefined}
            style={{ width: amountWidth }}
            className="max-w-full min-w-0 bg-transparent text-display money placeholder:text-muted/60 focus:outline-none"
          />
        </div>
        {amountError && (
          <p
            id="tx-amount-error"
            role="alert"
            className="mt-1.5 text-center text-caption text-negative"
          >
            {amountError}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-small text-text">{t("category")}</legend>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <div role="radiogroup" aria-label={t("category")} className="flex flex-wrap gap-2">
              {visible.map((c) => {
                const active = field.value === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => field.onChange(c.id)}
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
              {ordered.length > visible.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex h-10 items-center rounded-full border border-dashed border-border px-3.5 text-small text-muted hover:text-text"
                >
                  {t("allCategories", { count: ordered.length - visible.length })}
                </button>
              )}
            </div>
          )}
        />
        {errors.categoryId && (
          <p role="alert" className="mt-1.5 text-caption text-negative">
            {v(errors.categoryId.message)}
          </p>
        )}
      </fieldset>

      <div>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="inline-flex h-9 items-center gap-1.5 text-small text-muted hover:text-text"
        >
          <ChevronDown
            className={cn("size-4 transition-transform duration-[180ms]", more && "rotate-180")}
            aria-hidden
          />
          {t("more")}
        </button>
        <AnimatePresence initial={false}>
          {more && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={fadeTransition}
              className="overflow-hidden"
            >
              <div className="space-y-4 px-0.5 pt-3 pb-1">
                <Field
                  label={t("description")}
                  hint={t("descriptionHint")}
                  error={v(errors.description?.message)}
                >
                  {(a11y) => (
                    <Input
                      {...a11y}
                      {...register("description")}
                      placeholder={t("descriptionPlaceholder")}
                    />
                  )}
                </Field>
                <Field label={t("date")} error={v(errors.occurredOn?.message)}>
                  {(a11y) => <Input {...a11y} type="date" {...register("occurredOn")} />}
                </Field>
                <Field label={t("note")} error={v(errors.note?.message)}>
                  {(a11y) => (
                    <Input {...a11y} {...register("note")} placeholder={t("notePlaceholder")} />
                  )}
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-3">
        {onDelete && (
          <Button type="button" variant="danger" size="lg" onClick={onDelete} disabled={pending}>
            <Trash2 aria-hidden />
            <span className="sr-only sm:not-sr-only">{t("delete")}</span>
          </Button>
        )}
        <Button type="submit" size="lg" block loading={pending} className="flex-1">
          {initial ? t("update") : t("save")}
        </Button>
      </div>
    </form>
  );
}
