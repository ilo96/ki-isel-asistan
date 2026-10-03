"use client";

import { Brain, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { forgetMemoryAction } from "./actions";

/** Plan: Profil → "AI'ın hatırladıkları"; kullanıcı görür ve silebilir. */
export function MemoryList({ items }: { items: { id: string; content: string }[] }) {
  const t = useTranslations("profile");
  const [, start] = useTransition();
  const [rows, remove] = useOptimistic(items, (state, id: string) => state.filter((m) => m.id !== id));

  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <span className="ai-gradient grid size-8 place-items-center rounded-full text-white">
          <Brain className="size-4" aria-hidden />
        </span>
        <CardTitle>{t("memories")}</CardTitle>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-small text-muted">{t("memoriesEmpty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 text-body text-text">{m.content}</span>
              <button
                type="button"
                aria-label={t("forget")}
                onClick={() =>
                  start(async () => {
                    remove(m.id);
                    await forgetMemoryAction(m.id);
                  })
                }
                className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-muted hover:text-negative"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
