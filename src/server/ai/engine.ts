import type { ChatEvent } from "@/lib/assistant/types";
import type { ToolCallOutcome } from "./executor";
import type { ToolContext } from "./tools";

/** Sohbet motorlarının ortak arayüzü: Claude ve çevrimdışı motor aynı araçları çağırır. */
export type EngineInput = {
  ctx: ToolContext;
  text: string;
  history: { role: "user" | "assistant"; content: string }[];
  memories: string[];
  call: (name: string, input: unknown) => Promise<ToolCallOutcome>;
  emit: (event: ChatEvent) => void;
  signal: AbortSignal;
};

export type Engine = (input: EngineInput) => Promise<void>;

/** Bir turda en fazla bu kadar araç çağrısı (plan: AI mimarisi). */
export const MAX_TOOL_CALLS = 5;
