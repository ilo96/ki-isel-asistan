import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/server/env";
import { MAX_TOOL_CALLS, type Engine } from "./engine";
import { systemPrompt } from "./prompt";
import { TOOLS } from "./registry";

/*
 * Claude motoru: akışlı, elle yürütülen araç döngüsü. Araç girdileri akarken gelir
 * (eager_input_streaming); bu yüzden her girdi çalıştırılmadan önce executor'da Zod ile
 * doğrulanır. Ret ve kesilme durumlarında o turun araçları çalıştırılmaz.
 */

const MAX_TURNS = MAX_TOOL_CALLS + 1;
const MAX_JSON_RETRIES = 2;

let client: Anthropic | undefined;
function getClient() {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}

/** Zod şemalarından API'nin beklediği araç tanımları; bir kez üretilir. */
let toolDefs: Anthropic.Beta.BetaTool[] | undefined;
function tools(): Anthropic.Beta.BetaTool[] {
  toolDefs ??= TOOLS.map((t) => {
    const schema = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: t.name,
      description: t.description,
      input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      eager_input_streaming: true,
    };
  });
  return toolDefs;
}

export const claudeEngine: Engine = async ({ ctx, text, history, memories, call, emit, signal }) => {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: text },
  ];
  let toolCalls = 0;
  let jsonRetries = 0;
  let wroteText = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = getClient().beta.messages.stream(
      {
        model: env().AI_MODEL,
        max_tokens: 4096,
        system: systemPrompt(ctx, memories),
        tools: tools(),
        tool_choice: { type: "auto" },
        messages,
        // Ret durumunda istek sunucu tarafında önerilen modelle yeniden denenir.
        fallbacks: "default",
        betas: ["server-side-fallback-2026-07-01"],
      },
      { signal },
    );

    let separated = !wroteText;
    stream.on("text", (delta) => {
      if (!separated) {
        emit({ type: "text-delta", text: "\n\n" });
        separated = true;
      }
      wroteText = true;
      emit({ type: "text-delta", text: delta });
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Yalnızca ayrıştırılamayan araç girdisi yeniden denenir; API hataları yukarı çıkar.
      if (error instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= MAX_JSON_RETRIES) {
        throw error;
      }
      continue;
    }

    if (message.stop_reason === "refusal") {
      if (!wroteText) emit({ type: "text-delta", text: "Bu isteğe yardımcı olamıyorum." });
      return;
    }
    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0) return;
    // Kesilmiş bir girdi geçerli görünebilir; çalıştırmak yerine dur.
    if (message.stop_reason === "max_tokens") throw new Error("Araç girdisi max_tokens ile kesildi");

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      if (toolCalls >= MAX_TOOL_CALLS) {
        results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: '{"error":"tool_call_limit"}' });
        continue;
      }
      toolCalls++;
      const outcome = await call(use.name, use.input);
      results.push({ type: "tool_result", tool_use_id: use.id, content: outcome.content, is_error: outcome.isError });
    }
    messages.push({ role: "user", content: results });
  }
};
