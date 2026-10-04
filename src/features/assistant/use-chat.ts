"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEvent, ChatMessage, MessagePart } from "@/lib/assistant/types";

/*
 * Sohbet durumu: mesajı POST eder, SSE olaylarını okuyup son asistan mesajına uygular.
 * Yeni konuşma açılınca adres /assistant/[id] olur (sayfa yeniden yüklenmeden).
 */

export type ChatStatus = "idle" | "streaming" | "error";
export type ChatErrorCode = Extract<ChatEvent, { type: "error" }>["code"];

let localSeq = 0;
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${localSeq++}`;

function apply(message: ChatMessage, event: ChatEvent): ChatMessage {
  switch (event.type) {
    case "text-delta":
      return { ...message, content: message.content + event.text };
    case "tool-start":
      return {
        ...message,
        parts: [
          ...message.parts,
          { type: "tool", id: event.id, name: event.name, status: "running", label: event.label },
        ],
      };
    case "tool-end":
      return {
        ...message,
        parts: message.parts.map((p) =>
          p.type === "tool" && p.id === event.id
            ? { ...p, status: event.ok ? "done" : "error", label: event.label }
            : p,
        ),
      };
    case "action": {
      return { ...message, parts: [...message.parts, { ...event, type: "action" }] };
    }
    default:
      return message;
  }
}

/** "data: {...}\n\n" bloklarını ayrıştırır; yarım kalan blok bir sonraki parçaya devreder. */
function* readEvents(buffer: { text: string }): Generator<ChatEvent> {
  let index: number;
  while ((index = buffer.text.indexOf("\n\n")) !== -1) {
    const block = buffer.text.slice(0, index);
    buffer.text = buffer.text.slice(index + 2);
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice(6))
      .join("\n");
    if (data) yield JSON.parse(data) as ChatEvent;
  }
}

export function useChat({
  conversationId: initialId,
  initialMessages,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<ChatErrorCode | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [statusText, setStatusText] = useState<string | null>(null);
  const conversationId = useRef(initialId);
  const abort = useRef<AbortController | null>(null);

  // Geçmişten başka bir sohbete (ya da yeni sohbete) geçilince durum sıfırlanır. Yeni sohbetin
  // adresi /assistant/[id] olunca gelen aynı id sıfırlamaz; akan yanıt korunur.
  useEffect(() => {
    if (initialId === conversationId.current) return;
    abort.current?.abort();
    conversationId.current = initialId;
    setMessages(initialMessages);
    setSuggestions([]);
    setError(null);
    setStatus("idle");
  }, [initialId, initialMessages]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || abort.current) return;
      const controller = new AbortController();
      abort.current = controller;
      const assistantId = localId("a");
      setMessages((m) => [
        ...m,
        { id: localId("u"), role: "user", content: text, parts: [] },
        { id: assistantId, role: "assistant", content: "", parts: [] },
      ]);
      setSuggestions([]);
      setError(null);
      setStatus("streaming");
      let wrote = false;
      let navigateTo: string | null = null;

      const update = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((all) => all.map((m) => (m.id === assistantId ? fn(m) : m)));

      try {
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversationId.current, text }),
          signal: controller.signal,
        });
        if (!response.body) throw new Error("Yanıt gövdesi yok");
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        const buffer = { text: "" };
        let failed: ChatErrorCode | null = null;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer.text += value;
          for (const event of readEvents(buffer)) {
            switch (event.type) {
              case "start":
                if (!conversationId.current) {
                  conversationId.current = event.conversationId;
                  window.history.replaceState(null, "", `/assistant/${event.conversationId}`);
                }
                break;
              case "status":
                setStatusText(event.text);
                break;
              case "suggestions":
                setSuggestions(event.items);
                break;
              case "navigate":
                navigateTo = event.href;
                break;
              case "error":
                failed = event.code;
                break;
              case "done":
                break;
              default:
                if (event.type === "action" && event.state === "executed" && event.actionId) {
                  wrote = true;
                }
                update((m) => apply(m, event));
            }
          }
        }
        if (failed) {
          setError(failed);
          setStatus("error");
          // Boş kalan asistan balonunu kaldır.
          setMessages((all) =>
            all.filter((m) => m.id !== assistantId || m.content || m.parts.length),
          );
        } else {
          setStatus("idle");
        }
      } catch (e) {
        if (controller.signal.aborted) {
          setStatus("idle");
        } else {
          console.error(e);
          setError("unknown");
          setStatus("error");
        }
      } finally {
        abort.current = null;
        setStatusText(null);
        // Okunmamış rozeti ve kenar çubuğu gibi düzen verisi tazelensin.
        if (wrote) router.refresh();
        if (navigateTo) router.push(navigateTo);
      }
    },
    [router],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  /** Kartın durumu değişince (onay, geri al) yerinde güncelle. */
  const updatePart = useCallback(
    (messageId: string, partId: string, patch: Partial<Extract<MessagePart, { type: "action" }>>) => {
      setMessages((all) =>
        all.map((m) =>
          m.id !== messageId
            ? m
            : {
                ...m,
                parts: m.parts.map((p) =>
                  p.type === "action" && p.id === partId ? { ...p, ...patch } : p,
                ),
              },
        ),
      );
    },
    [],
  );

  return { messages, status, error, suggestions, statusText, send, stop, updatePart };
}
