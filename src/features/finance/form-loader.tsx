"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { QuickAddData } from "./actions";

type Props = {
  data: QuickAddData | null;
  failed: boolean;
  onRetry: () => void;
  children: (data: QuickAddData) => ReactNode;
};

/** Form verisi gelene kadar iskelet, hata olursa sade mesaj ve "Tekrar dene". */
export function FormLoader({ data, failed, onRetry, children }: Props) {
  const t = useTranslations("state");
  if (data) return children(data);
  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-body text-muted">{t("errorBody")}</p>
        <Button variant="secondary" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-5" aria-busy>
      <Skeleton className="h-[84px] rounded-card" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-button" />
    </div>
  );
}
