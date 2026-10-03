"use client";

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
import { mmToCm } from "@/lib/fitness/units";
import {
  parseMeasurementForm,
  type FieldError,
  type FieldWarning,
  type Sex,
} from "@/lib/validation/fitness";
import { saveMeasurementAction, undoMeasurementAction } from "./actions";

type Props = {
  open: boolean;
  onClose: () => void;
  today: DateString;
  profile: { heightMm: number | null; age: number | null; sex: Sex | null } | null;
};

const decimal = (n: number) => String(n).replace(".", ",");

/** Boy, kilo, yaş ve cinsiyet. Boy bir kez girilir; kilo her ölçümde. */
export function MeasurementSheet({ open, onClose, today, profile }: Props) {
  const t = useTranslations("fitness");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("measure.title")}
      description={t("measure.body")}
      closeLabel={t("close")}
    >
      {open && <MeasurementForm onClose={onClose} today={today} profile={profile} />}
    </Sheet>
  );
}

function MeasurementForm({ onClose, today, profile }: Omit<Props, "open">) {
  const t = useTranslations("fitness");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [height, setHeight] = useState(profile?.heightMm ? decimal(mmToCm(profile.heightMm)) : "");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
  const [sex, setSex] = useState<Sex | "">(profile?.sex ?? "");
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Partial<Record<string, FieldError>>>({});
  const [warnings, setWarnings] = useState<FieldWarning[]>([]);
  const [failed, setFailed] = useState(false);
  // Uyarı (alışılmadık değer) bir kez gösterilir; ikinci basışta kaydedilir.
  const [confirmed, setConfirmed] = useState(false);

  const save = () => {
    const r = parseMeasurementForm(
      { height, weight, age, sex, date },
      { requireHeight: !profile?.heightMm, requireWeight: !!profile?.heightMm, today },
    );
    setFailed(false);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    const unusual = r.warnings.filter((w) => w !== "heightInMeters");
    if (unusual.length && !confirmed) {
      setWarnings(r.warnings);
      setConfirmed(true);
      return;
    }
    if (r.warnings.includes("heightInMeters") && r.value.heightCm)
      setHeight(decimal(r.value.heightCm));
    start(async () => {
      const res = await saveMeasurementAction(r.value);
      if (!res.ok) return setFailed(true);
      onClose();
      toast({
        message: t("measure.saved"),
        tone: "success",
        action: { label: t("undo"), onClick: () => void undoMeasurementAction(res.data) },
      });
    });
  };

  const err = (key: string) => (errors[key] ? t(`errors.${errors[key]}`) : undefined);
  const sexOptions = [
    { value: "female", label: t("sex.female") },
    { value: "male", label: t("sex.male") },
    { value: "other", label: t("sex.other") },
  ] as const;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {failed && <FormAlert>{t("errors.unknown")}</FormAlert>}
      {errors.form && <FormAlert>{t("errors.empty")}</FormAlert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("measure.height")} hint={t("measure.heightHint")} error={err("height")}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              autoComplete="off"
              placeholder="175"
              value={height}
              onChange={(e) => (setHeight(e.target.value), setConfirmed(false))}
            />
          )}
        </Field>
        <Field label={t("measure.weight")} hint={t("measure.weightHint")} error={err("weight")}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              autoComplete="off"
              placeholder="72,5"
              autoFocus={!!profile?.heightMm}
              value={weight}
              onChange={(e) => (setWeight(e.target.value), setConfirmed(false))}
            />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("measure.age")} hint={t("optional")} error={err("age")}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="off"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          )}
        </Field>
        <Field label={t("measure.date")} error={err("date")}>
          {(p) => (
            <Input
              {...p}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div>
        <p className="mb-2 text-small text-text">
          {t("measure.sex")} <span className="text-muted">({t("optional")})</span>
        </p>
        <SegmentedControl
          label={t("measure.sex")}
          options={sexOptions}
          value={sex || ("" as Sex)}
          onChange={(v) => setSex(v === sex ? "" : v)}
        />
      </div>
      {confirmed && warnings.length > 0 && (
        <p
          role="status"
          className="rounded-input bg-warning-soft px-3.5 py-2.5 text-small text-warning"
        >
          {warnings
            .filter((w) => w !== "heightInMeters")
            .map((w) => t(`warnings.${w}`))
            .join(" ")}{" "}
          {t("warnings.confirm")}
        </p>
      )}
      <p className="text-caption text-muted">{t("privacy")}</p>
      <Button type="submit" block loading={pending}>
        {confirmed && warnings.length ? t("saveAnyway") : t("save")}
      </Button>
    </form>
  );
}
