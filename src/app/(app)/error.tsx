"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/error-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("state");
  return (
    <div className="pt-6">
      <ErrorState title={t("errorTitle")} description={t("errorBody")} retryLabel={t("retry")} onRetry={reset} />
    </div>
  );
}
