"use client";

import { ArrowUp, Check, Loader2, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { AssistantOrb, type OrbState } from "@/components/assistant/assistant-orb";
import type { ChatMessage, MessagePart } from "@/lib/assistant/types";
import { cn } from "@/lib/cn";
import { fadeTransition, staggerDelay } from "@/lib/motion";
import { ActionCardView } from "./action-card";
import { useChat } from "./use-chat";

/** **kalın** ve satır başı listeleri; Claude'un kısa yanıtları için yeterli. */
function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
      chunk.startsWith("**") && chunk.endsWith("**") ? (
        <strong key={i} className="font-semibold">
          {chunk.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{chunk}</Fragment>
      ),
    );
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-1 space-y-1">
          {list.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2.5 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of text.split("\n")) {
    const item = line.match(/^\s*(?:[-•*]|\d+\.)\s+(.*)$/);
    if (item) {
      list.push(item[1]!);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function ToolChip({ part }: { part: Extract<MessagePart, { type: "tool" }> }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-caption text-muted">
      {part.status === "running" ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : part.status === "done" ? (
        <Check className="size-3.5 text-positive" aria-hidden />
      ) : (
        <X className="size-3.5 text-negative" aria-hidden />
      )}
      {part.label}
    </span>
  );
}

export function ChatView({
  conversationId,
  initialMessages,
  initialPrompt,
  offline,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialPrompt?: string;
  offline: boolean;
}) {
  const t = useTranslations("assistantPage");
  const chat = useChat({ conversationId, initialMessages });
  const [value, setValue] = useState("");
  const [orbDone, setOrbDone] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);
  const streaming = chat.status === "streaming";
  const last = chat.messages.at(-1);
  const waiting = streaming && last?.role === "assistant" && !last.content && last.parts.length === 0;

  // Komut paletinden gelen soru bir kez gönderilir.
  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      void chat.send(initialPrompt);
    }
  }, [initialPrompt, chat]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages, chat.suggestions]);

  // Yanıt bitince küre bir kez "tamam" der.
  const wasStreaming = useRef(false);
  useEffect(() => {
    const finished = wasStreaming.current && !streaming;
    wasStreaming.current = streaming;
    if (finished && chat.status !== "error") {
      setOrbDone(true);
      const id = setTimeout(() => setOrbDone(false), 700);
      return () => clearTimeout(id);
    }
  }, [streaming, chat.status]);

  const orb: OrbState = chat.status === "error" ? "error" : streaming ? "thinking" : orbDone ? "done" : "idle";
  const empty = chat.messages.length === 0;
  const starters = t.raw("suggestions") as string[];

  const submit = () => {
    if (!value.trim() || streaming) return;
    void chat.send(value);
    setValue("");
    input.current?.focus();
  };

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col lg:min-h-[calc(100dvh-12rem)]">
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <AssistantOrb size="xl" state={orb} />
          <h2 className="mt-6 text-h1 text-text">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-sm text-body text-muted">{t("emptyBody")}</p>
          <ul className="mt-8 flex max-w-xl flex-wrap justify-center gap-2">
            {starters.map((s, i) => (
              <motion.li key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: staggerDelay(i) }}>
                <button
                  type="button"
                  onClick={() => void chat.send(s)}
                  className="rounded-full border border-border bg-surface px-4 py-2.5 text-small text-text transition-colors hover:border-accent/50 hover:text-accent"
                >
                  {s}
                </button>
              </motion.li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="flex flex-1 flex-col gap-5 pb-6" aria-live="polite" aria-busy={streaming}>
          {chat.messages.map((m) =>
            m.role === "user" ? (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeTransition}
                className="ml-auto max-w-[85%] rounded-[1.25rem] rounded-br-md bg-accent-strong px-4 py-2.5 text-body whitespace-pre-wrap text-on-accent"
              >
                {m.content}
              </motion.li>
            ) : (
              <li key={m.id} className="flex max-w-[92%] gap-3">
                <AssistantOrb size="sm" state={m.id === last?.id ? orb : "idle"} className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-3">
                  {m.parts.some((p) => p.type === "tool") && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.parts.map((p) => (p.type === "tool" ? <ToolChip key={p.id} part={p} /> : null))}
                    </div>
                  )}
                  {m.content ? (
                    <div className="text-body text-pretty text-text">
                      <RichText text={m.content} />
                    </div>
                  ) : m.id === last?.id && waiting ? (
                    <p className="text-body text-muted">{chat.statusText ?? t("thinking")}</p>
                  ) : null}
                  {m.parts.map((p) =>
                    p.type === "action" ? (
                      <ActionCardView key={p.id} part={p} onChange={(patch) => chat.updatePart(m.id, p.id, patch)} />
                    ) : null,
                  )}
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      <AnimatePresence>
        {chat.error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mb-3 rounded-input bg-negative-soft px-4 py-3 text-small text-negative"
          >
            {t(`errors.${chat.error === "rate_limited" ? "rateLimited" : chat.error === "unauthorized" ? "unauthorized" : "unknown"}`)}
          </motion.p>
        )}
      </AnimatePresence>

      {!streaming && chat.suggestions.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label={t("suggestionsLabel")}>
          {chat.suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => void chat.send(s)}
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-small text-text transition-colors hover:border-accent/50 hover:text-accent"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={bottom} />

      <form
        className="sticky bottom-24 z-10 lg:bottom-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="glass flex items-end gap-2 rounded-sheet border border-border p-2 pl-5 shadow-raised">
          <textarea
            ref={input}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={1000}
            placeholder={t("inputPlaceholder")}
            aria-label={t("inputPlaceholder")}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body text-text outline-none [field-sizing:content] placeholder:text-muted focus-visible:outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={chat.stop}
              aria-label={t("stop")}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-text transition-transform active:scale-95"
            >
              <Square className="size-4 fill-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              aria-label={t("send")}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-strong text-on-accent transition-[transform,opacity] active:scale-95 disabled:opacity-40"
            >
              <ArrowUp className="size-5" aria-hidden />
            </button>
          )}
        </div>
        <p className={cn("mt-2 text-center text-caption text-muted", !offline && "sr-only")}>
          {offline ? t("offlineNote") : t("aiNote")}
        </p>
      </form>
    </div>
  );
}
