"use client";

import { History, MessageSquarePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { ConversationSummary } from "@/lib/assistant/types";
import { cn } from "@/lib/cn";
import { deleteConversationAction } from "./actions";

const when = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Sohbet başlığındaki iki düğme: geçmiş (sheet) ve yeni sohbet. */
export function ConversationHistory({
  conversations,
  currentId,
}: {
  conversations: ConversationSummary[];
  currentId: string | null;
}) {
  const t = useTranslations("assistantPage");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(conversations);
  const [pending, start] = useTransition();

  const remove = (id: string) =>
    start(async () => {
      const r = await deleteConversationAction(id);
      if (!r.ok) return;
      setItems((all) => all.filter((c) => c.id !== id));
      if (id === currentId) router.push("/assistant");
    });

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="icon" aria-label={t("history")} onClick={() => setOpen(true)}>
        <History aria-hidden />
      </Button>
      <Button asChild variant="soft" size="icon" aria-label={t("newChat")}>
        <Link href="/assistant" onClick={() => router.refresh()}>
          <MessageSquarePlus aria-hidden />
        </Link>
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={t("history")} closeLabel={t("close")}>
        {items.length === 0 ? (
          <p className="py-6 text-center text-body text-muted">{t("historyEmpty")}</p>
        ) : (
          <ul className="-mx-2 divide-y divide-border/60">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link
                  href={`/assistant/${c.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={c.id === currentId ? "page" : undefined}
                  className={cn(
                    "min-w-0 flex-1 rounded-input px-2 py-3 transition-colors hover:bg-surface-muted",
                    c.id === currentId && "text-accent",
                  )}
                >
                  <span className="block truncate text-body">{c.title}</span>
                  <span className="text-caption text-muted">{when.format(new Date(c.lastMessageAt))}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("deleteChat")}
                  disabled={pending}
                  onClick={() => remove(c.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
