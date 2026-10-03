"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { demoDataAction } from "./demo-actions";

type Props = { mode: "seed" | "clear"; className?: string };

/** Geliştirme ortamında örnek veriyi yükler ya da temizler. Production'da hiç render edilmez. */
export function DemoDataButton({ mode, className }: Props) {
  const t = useTranslations("home.demo");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className={className}>
      <Button
        variant={mode === "seed" ? "soft" : "danger"}
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await demoDataAction(mode);
            setFailed(!res.ok);
          })
        }
      >
        {mode === "seed" ? <FlaskConical aria-hidden /> : <Trash2 aria-hidden />}
        {t(mode)}
      </Button>
      <p className="mt-1.5 text-caption text-muted" role={failed ? "alert" : undefined}>
        {failed ? t("failed") : t("devOnly")}
      </p>
    </div>
  );
}
