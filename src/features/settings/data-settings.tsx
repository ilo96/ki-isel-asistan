"use client";

import { Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { DELETE_CONFIRM_WORD } from "@/lib/validation/settings";
import { deleteAccountAction } from "./actions";

/** Verilerimi indir (JSON / CSV) ve hesabı kalıcı silme (plan: Ayarlar). */
export function DataSettings() {
  const t = useTranslations("settingsPage");
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Card>
        <CardTitle>{t("data")}</CardTitle>
        <p className="mt-1 text-small text-muted">{t("dataBody")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href="/api/export" download>
              <Download aria-hidden />
              {t("exportJson")}
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/export?format=csv" download>
              <FileSpreadsheet aria-hidden />
              {t("exportCsv")}
            </a>
          </Button>
        </div>
      </Card>

      <Card className="border-negative/30">
        <CardTitle>{t("deleteTitle")}</CardTitle>
        <p className="mt-1 text-small text-muted">{t("deleteBody")}</p>
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          {t("deleteButton")}
        </Button>
      </Card>

      <Sheet open={open} onOpenChange={setOpen} title={t("deleteTitle")} description={t("deleteSheetBody")} closeLabel={t("close")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await deleteAccountAction(word);
              if (r && !r.ok) setError(true);
            });
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-small text-text">{t("deleteType", { word: DELETE_CONFIRM_WORD })}</span>
            <Input
              value={word}
              onChange={(e) => {
                setWord(e.target.value);
                setError(false);
              }}
              autoComplete="off"
              aria-invalid={error || undefined}
            />
          </label>
          {error && (
            <p role="alert" className="text-small text-negative">
              {t("deleteError")}
            </p>
          )}
          <Button
            type="submit"
            variant="danger"
            block
            loading={pending}
            disabled={word.trim().toLocaleUpperCase("tr-TR") !== DELETE_CONFIRM_WORD}
          >
            {t("deleteConfirm")}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
