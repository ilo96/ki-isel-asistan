"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./button";

type ErrorStateProps = {
  title: string;
  description: string;
  retryLabel: string;
  onRetry?: () => void;
};

/** Bölüm içi hata kartı. Teknik mesaj kullanıcıya asla gösterilmez. */
export function ErrorState({ title, description, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-border bg-surface p-5">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-negative" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold text-text">{title}</p>
        <p className="mt-0.5 text-small text-muted">{description}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCcw aria-hidden />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
