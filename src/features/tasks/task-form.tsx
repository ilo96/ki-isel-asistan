"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FormAlert } from "@/features/auth/form-alert";
import { useValidationMessage } from "@/features/auth/use-auth-error";
import { addDays, type DateString } from "@/lib/dates";
import type { LifeItem } from "@/lib/life/types";
import { taskInputSchema, type TaskInput } from "@/lib/validation/life";
import { saveTaskAction, type LifeActionError } from "./actions";
import { PriorityPicker } from "./reminder-form";

type TaskItem = Extract<LifeItem, { type: "task" }>;
type Due = "none" | "today" | "tomorrow" | "pick";

type Props = {
  today: DateString;
  initial?: TaskItem;
  onSaved: (id: string) => void;
  onDelete?: () => void;
};

function dueOf(date: DateString | null, today: DateString): Due {
  if (!date) return "none";
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return "pick";
}

/** Saatsiz yapılacak: başlık, isteğe bağlı gün, öncelik ve not. */
export function TaskForm({ today, initial, onSaved, onDelete }: Props) {
  const t = useTranslations("life");
  const v = useValidationMessage();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<LifeActionError | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [due, setDue] = useState<Due>(initial ? dueOf(initial.date, today) : "today");
  const [picked, setPicked] = useState(initial?.date ?? addDays(today, 2));
  const [priority, setPriority] = useState(initial?.priority ?? "normal");
  const [note, setNote] = useState(initial?.note ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const dueOn =
      due === "none"
        ? null
        : due === "today"
          ? today
          : due === "tomorrow"
            ? addDays(today, 1)
            : picked;
    const input: TaskInput = { title, note, dueOn, priority };
    const parsed = taskInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveTaskAction(initial?.id ?? null, input);
      if (result.ok) onSaved(result.data.id);
      else setServerError(result.error);
    });
  };

  const dues = (["none", "today", "tomorrow", "pick"] as const).map((value) => ({
    value,
    label: t(`due.${value}`),
  }));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError && <FormAlert>{t("errors.unknown")}</FormAlert>}
      <Field label={t("taskTitle")} error={v(errors.title)}>
        {(a11y) => (
          <Input
            {...a11y}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("taskPlaceholder")}
            autoFocus={!initial}
          />
        )}
      </Field>
      <div>
        <p className="mb-1.5 text-small text-text">{t("dueLabel")}</p>
        <SegmentedControl
          options={dues}
          value={due}
          onChange={setDue}
          label={t("dueLabel")}
          className="flex w-full"
        />
        {due === "pick" && (
          <Input
            type="date"
            aria-label={t("date")}
            value={picked}
            min={today}
            onChange={(e) => setPicked(e.target.value)}
            className="mt-2"
          />
        )}
        {errors.dueOn && (
          <p role="alert" className="mt-1.5 text-caption text-negative">
            {v(errors.dueOn)}
          </p>
        )}
      </div>
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
