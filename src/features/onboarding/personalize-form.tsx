"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ComponentProps } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FormAlert } from "@/features/auth/form-alert";
import { useValidationMessage } from "@/features/auth/use-auth-error";
import { parseMoneyInput } from "@/lib/money";
import { CURRENCIES, onboardingSchema } from "@/lib/validation/auth";
import { completeOnboardingAction } from "./actions";

/** Tutarlar formda metin olarak tutulur ("25.000"); gönderirken kuruşa çevrilir. */
const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === "" || (parseMoneyInput(v) ?? 0) > 0, "amount");

const formSchema = onboardingSchema
  .omit({ monthlyIncomeMinor: true, savingGoalMinor: true })
  .extend({ income: optionalAmount, goal: optionalAmount });

type FormValues = z.infer<typeof formSchema>;

const toMinor = (v: string) => (v.trim() === "" ? null : parseMoneyInput(v));

const SYMBOLS = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" } as const;

export function PersonalizeForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("onboarding");
  const v = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: defaultName, currency: "TRY", income: "", goal: "" },
  });
  const symbol = SYMBOLS[watch("currency")];

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction({
        name: values.name,
        currency: values.currency,
        monthlyIncomeMinor: toMinor(values.income),
        savingGoalMinor: toMinor(values.goal),
      });
      if (result?.error) setServerError(t(`errors.${result.error}`));
    });
  });

  const amountProps = { inputMode: "decimal" as const, autoComplete: "off", placeholder: "0" };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && <FormAlert>{serverError}</FormAlert>}
      <Field label={t("name")} error={v(errors.name?.message)}>
        {(a11y) => <Input {...a11y} {...register("name")} autoComplete="given-name" />}
      </Field>

      <div className="space-y-1.5">
        <p className="text-small text-text" aria-hidden>
          {t("currency")}
        </p>
        <Controller
          control={control}
          name="currency"
          render={({ field }) => (
            <SegmentedControl
              label={t("currency")}
              value={field.value}
              onChange={field.onChange}
              className="flex w-full"
              options={CURRENCIES.map((c) => ({ value: c, label: t(`currencies.${c}`) }))}
            />
          )}
        />
      </div>

      <Field label={t("income")} hint={t("incomeHint")} error={v(errors.income?.message)}>
        {(a11y) => (
          <AmountInput symbol={symbol} {...a11y} {...register("income")} {...amountProps} />
        )}
      </Field>
      <Field label={t("goal")} hint={t("goalHint")} error={v(errors.goal?.message)}>
        {(a11y) => <AmountInput symbol={symbol} {...a11y} {...register("goal")} {...amountProps} />}
      </Field>

      <Button type="submit" size="lg" block loading={pending}>
        {t("finish")}
      </Button>
    </form>
  );
}

function AmountInput({ symbol, ...props }: ComponentProps<typeof Input> & { symbol: string }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted"
      >
        {symbol}
      </span>
      <Input {...props} className="pl-8 money" />
    </div>
  );
}
