"use client";

import { Scissors, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { FormAlert } from "@/features/auth/form-alert";
import type { DateString } from "@/lib/dates";
import { formatMoney, parseMoneyInput, type CurrencyCode } from "@/lib/money";
import type { SubscriptionCycle, SubscriptionSuggestion } from "@/lib/subscriptions";
import { MAX_AMOUNT_MINOR } from "@/lib/validation/finance";
import type { SubscriptionView } from "@/server/services/subscriptions";
import { MoneyInput } from "./money-input";
import {
  cancelSubscriptionAction,
  deleteSubscriptionAction,
  saveSubscriptionAction,
} from "./subscription-actions";

export type SubscriptionCategory = { id: string; name: string };
export type SubscriptionTarget =
  | { kind: "new"; suggestion?: SubscriptionSuggestion }
  | { kind: "edit"; subscription: SubscriptionView };

type Props = {
  target: SubscriptionTarget | null;
  onClose: () => void;
  currency: CurrencyCode;
  today: DateString;
  categories: SubscriptionCategory[];
};

const toInput = (minor: number) => formatMoney(minor, { compact: true }).replace(/[^\d.,]/g, "");
const REMIND = [0, 1, 2, 3, 7] as const;
const selectClass =
  "h-11 w-full rounded-input border border-border bg-surface px-3 text-body text-text focus-visible:border-accent focus-visible:outline-none";

export function SubscriptionSheet(props: Props) {
  const t = useTranslations("subscriptions");
  const { target, onClose } = props;
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={target?.kind === "edit" ? target.subscription.name : t("add")}
      closeLabel={t("close")}
    >
      {target && <SubscriptionForm key={JSON.stringify(target)} {...props} target={target} />}
    </Sheet>
  );
}

function SubscriptionForm({
  target,
  onClose,
  currency,
  today,
  categories,
}: Props & { target: SubscriptionTarget }) {
  const t = useTranslations("subscriptions");
  const tv = useTranslations("validation");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const existing = target.kind === "edit" ? target.subscription : null;
  const seed = target.kind === "new" ? target.suggestion : undefined;

  const [name, setName] = useState(existing?.name ?? seed?.name ?? "");
  const [amount, setAmount] = useState(
    existing ? toInput(existing.amountMinor) : seed ? toInput(seed.amountMinor) : "",
  );
  const [cycle, setCycle] = useState<SubscriptionCycle>(
    existing?.cycle ?? seed?.cycle ?? "monthly",
  );
  const [date, setDate] = useState(existing?.nextChargeOn ?? seed?.nextChargeOn ?? today);
  const [remind, setRemind] = useState(existing?.remindDaysBefore ?? 2);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? seed?.categoryId ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  const save = () => {
    const minor = parseMoneyInput(amount);
    if (!name.trim()) return setError(tv("required"));
    if (minor === null) return setError(tv("amount"));
    if (minor <= 0) return setError(tv("amountPositive"));
    if (minor > MAX_AMOUNT_MINOR) return setError(tv("amountMax"));
    start(async () => {
      const r = await saveSubscriptionAction(existing?.id ?? null, {
        name,
        amountMinor: minor,
        cycle,
        // Düzenlemede gösterilen tarih bir sonraki ödeme; kayıt da ondan devam eder.
        nextChargeOn: date,
        categoryId: categoryId || null,
        remindDaysBefore: remind,
        note,
      });
      if (!r.ok) return setError(t("errors.unknown"));
      onClose();
      toast({ message: t(existing ? "updated" : "saved", { name: name.trim() }) });
    });
  };

  const cancel = () =>
    existing &&
    start(async () => {
      const r = await cancelSubscriptionAction(existing.id, true);
      if (!r.ok) return setError(t("errors.unknown"));
      onClose();
      toast({
        message: t("cancelled", {
          name: existing.name,
          amount: formatMoney(existing.monthlyMinor, { currency, compact: true }),
        }),
        tone: "success",
        action: {
          label: t("undo"),
          onClick: () => void cancelSubscriptionAction(existing.id, false),
        },
      });
    });

  const remove = () =>
    existing &&
    start(async () => {
      const r = await deleteSubscriptionAction(existing.id);
      if (!r.ok) return setError(t("errors.unknown"));
      onClose();
      toast({ message: t("deleted", { name: existing.name }) });
    });

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
      <Field label={t("name")}>
        {(a11y) => (
          <Input
            {...a11y}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={60}
            autoFocus={!existing && !seed}
          />
        )}
      </Field>
      <div>
        <label htmlFor="sub-amount" className="mb-2 block text-small text-text">
          {t("amount")}
        </label>
        <MoneyInput
          id="sub-amount"
          currency={currency}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <SegmentedControl
        label={t("cycle")}
        value={cycle}
        onChange={setCycle}
        options={(["weekly", "monthly", "yearly"] as const).map((value) => ({
          value,
          label: t(`cycles.${value}`),
        }))}
        className="flex w-full"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("nextCharge")}>
          {(a11y) => (
            <Input {...a11y} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </Field>
        <label className="space-y-1.5">
          <span className="block text-small text-text">{t("remind")}</span>
          <select
            value={remind}
            onChange={(e) => setRemind(Number(e.target.value))}
            className={selectClass}
          >
            {REMIND.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? t("remindSameDay") : t("remindDays", { count: d })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="block text-small text-text">{t("category")}</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={selectClass}
        >
          <option value="">{t("noCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Field label={t("note")}>
        {(a11y) => (
          <Input
            {...a11y}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder={t("notePlaceholder")}
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-3">
        {existing && (
          <>
            <Button
              type="button"
              variant="danger"
              size="lg"
              onClick={remove}
              disabled={pending}
              aria-label={t("delete")}
            >
              <Trash2 aria-hidden />
            </Button>
            <Button type="button" variant="secondary" size="lg" onClick={cancel} disabled={pending}>
              <Scissors aria-hidden />
              {t("cancel")}
            </Button>
          </>
        )}
        <Button type="submit" size="lg" loading={pending} className="flex-1">
          {existing ? t("update") : t("save")}
        </Button>
      </div>
    </form>
  );
}
