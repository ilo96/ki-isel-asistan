"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FormAlert } from "@/features/auth/form-alert";
import { useValidationMessage } from "@/features/auth/use-auth-error";
import { CategoryIcon } from "@/features/dashboard/category-icon";
import type { QuickAddData } from "@/features/finance/actions";
import { cn } from "@/lib/cn";
import type { LifeItem } from "@/lib/life/types";
import { fadeTransition } from "@/lib/motion";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { REPEAT_OPTIONS, reminderInputSchema, type ReminderInput } from "@/lib/validation/life";
import { saveReminderAction, type LifeActionError } from "./actions";

type ReminderItem = Extract<LifeItem, { type: "reminder" }>;

type Props = {
  data: QuickAddData;
  initial?: ReminderItem;
  onSaved: (id: string) => void;
  onDelete?: () => void;
  /** Düzenlemede ertele düğmeleri. */
  extra?: React.ReactNode;
};

export const selectClass =
  "h-11 w-full appearance-none rounded-input border border-border bg-surface px-3.5 text-body text-text focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none";

const toInput = (minor: number) => formatMoney(minor, { compact: true }).replace(/[^\d.,]/g, "");

/** Hatırlatıcı, fatura ya da önemli gün. Tutar ve kategori yalnızca faturada görünür. */
export function ReminderForm({ data, initial, onSaved, onDelete, extra }: Props) {
  const t = useTranslations("life");
  const v = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<LifeActionError | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [more, setMore] = useState(Boolean(initial?.note));

  const [kind, setKind] = useState<ReminderItem["kind"]>(initial?.kind ?? "reminder");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? data.today);
  const [allDay, setAllDay] = useState(initial ? initial.time === null : false);
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [repeat, setRepeat] = useState<ReminderInput["repeat"]>(initial?.repeat ?? "none");
  const [amount, setAmount] = useState(initial?.amountMinor ? toInput(initial.amountMinor) : "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [priority, setPriority] = useState<ReminderItem["priority"]>(initial?.priority ?? "normal");

  const expenseCategories = data.categories.filter(
    (c) => c.type === "expense" && (!c.archived || c.id === categoryId),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const amountMinor = kind === "bill" && amount.trim() ? parseMoneyInput(amount) : null;
    if (kind === "bill" && amount.trim() && amountMinor === null) {
      setErrors({ amountMinor: "amount" });
      return;
    }
    const input: ReminderInput = {
      kind,
      title,
      note,
      date,
      time: allDay ? null : time,
      priority,
      repeat,
      amountMinor,
      categoryId: kind === "bill" ? categoryId : null,
    };
    const parsed = reminderInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveReminderAction(initial?.id ?? null, input);
      if (result.ok) onSaved(result.data.id);
      else setServerError(result.error);
    });
  };

  const kinds = (["reminder", "bill", "important_date"] as const).map((value) => ({
    value,
    label: t(`kind.${value}`),
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && (
        <FormAlert>
          {t.has(`errors.${serverError}`) ? t(`errors.${serverError}`) : t("errors.unknown")}
        </FormAlert>
      )}

      <SegmentedControl
        options={kinds}
        value={kind}
        onChange={setKind}
        label={t("kindLabel")}
        className="flex w-full"
      />

      <Field label={t("titleLabel")} error={v(errors.title)}>
        {(a11y) => (
          <Input
            {...a11y}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(`titlePlaceholder.${kind}`)}
            autoFocus={!initial}
          />
        )}
      </Field>

      {kind === "bill" && (
        <Field label={t("amount")} hint={t("amountHint")} error={v(errors.amountMinor)}>
          {(a11y) => (
            <Input
              {...a11y}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="money"
            />
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} error={v(errors.date)}>
          {(a11y) => (
            <Input {...a11y} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </Field>
        <Field
          label={t("time")}
          error={v(errors.time)}
          aside={
            <label className="flex items-center gap-1.5 text-caption text-muted">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              {t("allDay")}
            </label>
          }
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="time"
              value={allDay ? "" : time}
              disabled={allDay}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label={t("repeatLabel")}>
        {(a11y) => (
          <select
            {...a11y}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderInput["repeat"])}
            className={selectClass}
          >
            {REPEAT_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {t(`repeatOption.${r}`)}
              </option>
            ))}
          </select>
        )}
      </Field>

      {kind === "bill" && (
        <fieldset>
          <legend className="mb-2 text-small text-text">{t("expenseCategory")}</legend>
          <div role="radiogroup" aria-label={t("expenseCategory")} className="flex flex-wrap gap-2">
            {expenseCategories.map((c) => {
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategoryId(active ? null : c.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border pr-3 pl-1 text-small transition-colors duration-[120ms]",
                    active
                      ? "border-accent bg-accent-soft text-text"
                      : "border-border bg-surface text-text hover:border-accent/40",
                  )}
                >
                  <CategoryIcon icon={c.icon} colorToken={c.colorToken} className="size-7" />
                  {c.name}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-caption text-muted">{t("expenseCategoryHint")}</p>
        </fieldset>
      )}

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
                <PriorityPicker value={priority} onChange={setPriority} />
                <Field label={t("note")} error={v(errors.note)}>
                  {(a11y) => (
                    <Input
                      {...a11y}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t("notePlaceholder")}
                    />
                  )}
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {extra}

      <div className="flex gap-3 pt-1">
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

export function PriorityPicker({
  value,
  onChange,
}: {
  value: "low" | "normal" | "high";
  onChange: (v: "low" | "normal" | "high") => void;
}) {
  const t = useTranslations("life");
  const options = (["low", "normal", "high"] as const).map((p) => ({
    value: p,
    label: t(`priority.${p}`),
  }));
  return (
    <div>
      <p className="mb-1.5 text-small text-text">{t("priorityLabel")}</p>
      <SegmentedControl
        options={options}
        value={value}
        onChange={onChange}
        label={t("priorityLabel")}
        className="flex w-full"
      />
    </div>
  );
}
