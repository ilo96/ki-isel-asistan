"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { FormAlert } from "@/features/auth/form-alert";
import { cn } from "@/lib/cn";
import type { DateString } from "@/lib/dates";
import {
  DISTANCE_TYPES,
  WORKOUT_LABEL,
  WORKOUT_TYPES,
  type WorkoutType,
} from "@/lib/fitness/activities";
import { metersToKm } from "@/lib/fitness/units";
import { parseWorkoutForm, type FieldError, type FieldWarning } from "@/lib/validation/fitness";
import type { WorkoutItem } from "@/server/services/fitness";
import { deleteWorkoutAction, restoreWorkoutAction, saveWorkoutAction } from "./actions";
import { WorkoutIcon } from "./workout-icon";

type Props = { target: WorkoutItem | "new" | null; onClose: () => void; today: DateString };

const decimal = (n: number) => String(n).replace(".", ",");

/** Aktivite ekle/düzenle. Kalori boş bırakılırsa süre, tür ve son kilodan tahmin edilir. */
export function WorkoutSheet({ target, onClose, today }: Props) {
  const t = useTranslations("fitness");
  const editing = target !== null && target !== "new";
  return (
    <Sheet
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t(editing ? "workout.editTitle" : "workout.title")}
      closeLabel={t("close")}
    >
      {target !== null && (
        <WorkoutForm
          key={editing ? target.id : "new"}
          existing={editing ? target : null}
          onClose={onClose}
          today={today}
        />
      )}
    </Sheet>
  );
}

function WorkoutForm({
  existing,
  onClose,
  today,
}: {
  existing: WorkoutItem | null;
  onClose: () => void;
  today: DateString;
}) {
  const t = useTranslations("fitness");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [type, setType] = useState<WorkoutType>(existing?.type ?? "walking");
  const [duration, setDuration] = useState(existing ? String(existing.durationMin) : "");
  const [distance, setDistance] = useState(
    existing?.distanceM ? decimal(metersToKm(existing.distanceM)) : "",
  );
  const [calories, setCalories] = useState(
    existing && !existing.caloriesEstimated && existing.calories ? String(existing.calories) : "",
  );
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<string, FieldError>>>({});
  const [warnings, setWarnings] = useState<FieldWarning[]>([]);
  const [failed, setFailed] = useState(false);
  const hasDistance = DISTANCE_TYPES.includes(type);

  const save = () => {
    const r = parseWorkoutForm(
      { type, duration, distance: hasDistance ? distance : "", calories, date, note },
      today,
    );
    setFailed(false);
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    if (r.warnings.length && !warnings.length) return setWarnings(r.warnings);
    start(async () => {
      const res = await saveWorkoutAction(existing?.id ?? null, r.value);
      if (!res.ok) return setFailed(true);
      onClose();
      toast({ message: t(existing ? "workout.updated" : "workout.saved"), tone: "success" });
    });
  };

  const remove = () => {
    if (!existing) return;
    start(async () => {
      const res = await deleteWorkoutAction(existing.id);
      if (!res.ok) return setFailed(true);
      onClose();
      toast({
        message: t("workout.deleted"),
        action: { label: t("undo"), onClick: () => void restoreWorkoutAction(existing.id) },
      });
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
      {failed && <FormAlert>{t("errors.unknown")}</FormAlert>}
      <fieldset>
        <legend className="mb-2 text-small text-text">{t("workout.type")}</legend>
        <div
          role="radiogroup"
          aria-label={t("workout.type")}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {WORKOUT_TYPES.map((w) => {
            const active = w === type;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(w)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-button border px-3 text-small transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text hover:bg-surface-muted",
                )}
              >
                <WorkoutIcon type={w} className="size-4 shrink-0" />
                <span className="truncate">{WORKOUT_LABEL[w]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t("workout.duration")}
          hint={t("workout.durationHint")}
          error={err("duration")}
        >
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="off"
              placeholder="30"
              value={duration}
              onChange={(e) => (setDuration(e.target.value), setWarnings([]))}
            />
          )}
        </Field>
        <Field label={t("workout.date")} error={err("date")}>
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
      <div className="grid grid-cols-2 gap-3">
        {hasDistance && (
          <Field label={t("workout.distance")} hint={t("optional")} error={err("distance")}>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                autoComplete="off"
                placeholder="5"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            )}
          </Field>
        )}
        <Field
          label={t("workout.calories")}
          hint={t("workout.caloriesHint")}
          error={err("calories")}
          className={hasDistance ? undefined : "col-span-2"}
        >
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="off"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label={t("workout.note")} hint={t("optional")}>
        {(p) => (
          <Input {...p} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        )}
      </Field>
      {warnings.length > 0 && (
        <p
          role="status"
          className="rounded-input bg-warning-soft px-3.5 py-2.5 text-small text-warning"
        >
          {warnings.map((w) => t(`warnings.${w}`)).join(" ")} {t("warnings.confirm")}
        </p>
      )}
      <div className="flex gap-2">
        {existing && (
          <Button type="button" variant="danger" onClick={remove} disabled={pending}>
            {t("delete")}
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={pending}>
          {warnings.length ? t("saveAnyway") : t("save")}
        </Button>
      </div>
    </form>
  );
}
