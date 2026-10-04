"use client";

import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { saveModuleAction } from "./actions";

/** Eklenti kapalıyken ekran: veriler silinmez, açınca geri gelir. */
export function ModuleDisabled() {
  const t = useTranslations("fitness");
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Card>
      <EmptyState
        icon={Activity}
        title={t("disabledTitle")}
        description={t("disabledBody")}
        action={
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await saveModuleAction("fitness", { enabled: true });
                if (!r.ok) toast({ message: t("errors.unknown"), tone: "error" });
              })
            }
          >
            {t("enable")}
          </Button>
        }
      />
    </Card>
  );
}
