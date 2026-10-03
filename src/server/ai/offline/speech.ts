import type { EngineInput } from "../engine";

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Cümleyi kelime kelime akıtır; arayüz Claude ile aynı görünür. */
export async function say(input: EngineInput, text: string) {
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += 4) {
    if (input.signal.aborted) return;
    input.emit({ type: "text-delta", text: parts.slice(i, i + 4).join("") });
    await wait(18, input.signal);
  }
}
