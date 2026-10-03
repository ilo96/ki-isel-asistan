"use client";

import { AlarmClock, CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useShell } from "@/components/layout/ui-store";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { FormLoader } from "@/features/finance/form-loader";
import { useQuickAddData } from "@/features/finance/use-quick-add-data";
import type { LifeItem } from "@/lib/life/types";
import { snoozeAction, unsnoozeAction } from "./actions";
import { ReminderForm } from "./reminder-form";
import { TaskForm } from "./task-form";
import { useLifeFeedback } from "./use-life-feedback";

/** Hatırlatıcı ya da göreve dokununca açılan düzenleme sheet'i; ertele ve sil de burada. */
export function EditLifeSheet() {
  const t = useTranslations("life");
  const { overlay, close, editingLife } = useShell();
  const title = editingLife?.type === "task" ? t("editTask") : t("editReminder");
  return (
    <Sheet
      open={overlay === "editLife" && editingLife !== null}
      onOpenChange={(next) => !next && close()}
      title={title}
      closeLabel={t("close")}
    >
      {editingLife && <Body key={editingLife.id} item={editingLife} onClose={close} />}
    </Sheet>
  );
}

function Body({ item, onClose }: { item: LifeItem; onClose: () => void }) {
  const t = useTranslations("life");
  const toast = useToast();
  const { data, failed, retry } = useQuickAddData(true);
  const feedback = useLifeFeedback();
  const [snoozing, setSnoozing] = useState(false);

  const onSaved = () => {
    onClose();
    toast({ message: t("updated") });
  };
  const onDelete = async () => {
    if (await feedback.remove(item)) onClose();
  };
  const snooze = async (preset: "hour" | "tomorrow") => {
    setSnoozing(true);
    const result = await snoozeAction(item.id, preset);
    setSnoozing(false);
    if (!result.ok) return toast({ message: t("errors.unknown"), tone: "error" });
    onClose();
    toast({
      message: t(preset === "hour" ? "snoozedHour" : "snoozedTomorrow"),
      action: {
        label: t("undo"),
        onClick: () => void unsnoozeAction(item.id, result.data.previousDueAt),
      },
    });
  };

  return (
    <FormLoader data={data} failed={failed} onRetry={retry}>
      {(loaded) =>
        item.type === "task" ? (
          <TaskForm today={loaded.today} initial={item} onSaved={onSaved} onDelete={onDelete} />
        ) : (
          <ReminderForm
            data={loaded}
            initial={item}
            onSaved={onSaved}
            onDelete={onDelete}
            extra={
              !item.completedAt && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <span className="mr-1 text-small text-muted">{t("snooze")}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={snoozing}
                    onClick={() => snooze("hour")}
                  >
                    <AlarmClock aria-hidden />
                    {t("snoozeHour")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={snoozing}
                    onClick={() => snooze("tomorrow")}
                  >
                    <CalendarClock aria-hidden />
                    {t("snoozeTomorrow")}
                  </Button>
                </div>
              )
            }
          />
        )
      }
    </FormLoader>
  );
}
