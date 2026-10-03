"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { FormAlert } from "@/features/auth/form-alert";
import type { DateString } from "@/lib/dates";
import { goalSafety } from "@/lib/fitness/goals";
import { parseLocaleNumber } from "@/lib/fitness/number";
import { formatWeight, gramsToKg, kgToGrams } from "@/lib/fitness/units";
import { parseGoalForm, type FieldError } from "@/lib/validation/fitness";
import type { GoalView } from "@/server/services/fitness";
import { saveGoalAction } from "./actions";
import { shortDate } from "./format";

type Props = {
  open: boolean;
  onClose: () => void;
  today: DateString;
  goal: GoalView | null;
  currentG: number | null;
  heightMm: number | null;
};

const decimal = (n: number) => String(n).replace(".", ",");

/** Kilo hedefi. Hedef tarih çok yakınsa ya da hedef sağlıklı aralığın altındaysa uyarır. */
export function GoalSheet(props: Props) {
  const t = useTranslations("fitness");
  return (
    <Sheet
      open={props.open}
      onOpenChange={(o) => !o && props.onClose()}
      title={t(props.goal ? "goal.editTitle" : "goal.title")}
      description={t("goal.body")}
      closeLabel={t("close")}
    >
      {props.open && <GoalForm {...props} />}
    </Sheet>
  );
}

function GoalForm({ onClose, today, goal, currentG, heightMm }: Props) {
  const t = useTranslations("fitness");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [startKg, setStartKg] = useState(currentG ? decimal(gramsToKg(currentG)) : "");
  const [target, setTarget] = useState(goal ? decimal(gramsToKg(goal.targetG)) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, FieldError>>>({});
  const [failed, setFailed] = useState<string | null>(null);

  // Yazarken güvenlik notu: hedef tarih için gereken haftalık hız ve sağlıklı aralık.
  const safety = useMemo(() => {
    const s = parseLocaleNumber(startKg);
    const tg = parseLocaleNumber(target);
    if (!s || !tg || Math.abs(s - tg) < 0.1) return null;
    return goalSafety(
      kgToGrams(s),
      kgToGrams(tg),
      /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : null,
      today,
      heightMm,
    );
  }, [startKg, target, targetDate, today, heightMm]);

  const save = () => {
    const r = parseGoalForm({ start: startKg, target, targetDate }, today);
    setFailed(null);
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    start(async () => {
      const res = await saveGoalAction(r.value);
      if (!res.ok)
        return setFailed(t(res.error === "no_weight" ? "errors.noWeight" : "errors.unknown"));
      onClose();
      toast({ message: t("goal.saved"), tone: "success" });
    });
  };

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {failed && <FormAlert>{failed}</FormAlert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("goal.start")} hint={t("goal.startHint")} error={err("start")}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              autoComplete="off"
              value={startKg}
              onChange={(e) => setStartKg(e.target.value)}
            />
          )}
        </Field>
        <Field label={t("goal.target")} error={err("target")}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="70"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label={t("goal.date")} hint={t("optional")} error={err("targetDate")}>
        {(p) => (
          <Input
            {...p}
            type="date"
            min={today}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        )}
      </Field>
      {safety && (safety.tooFast || safety.belowHealthyRange) && (
        <div
          role="status"
          className="space-y-1 rounded-input bg-warning-soft px-3.5 py-2.5 text-small text-warning"
        >
          {safety.tooFast && safety.requiredGPerWeek && (
            <p>
              {t("goal.tooFast", { perWeek: formatWeight(safety.requiredGPerWeek) })}
              {safety.saferDate && ` ${t("goal.saferDate", { date: shortDate(safety.saferDate) })}`}
            </p>
          )}
          {safety.belowHealthyRange && <p>{t("goal.belowRange")}</p>}
        </div>
      )}
      <p className="text-caption text-muted">{t("goal.consult")}</p>
      <Button type="submit" block loading={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
