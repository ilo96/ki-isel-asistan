import { fitnessPlugin } from "./fitness";
import type { AssistantPlugin } from "./types";

/** Asistana bağlı eklentiler (src/lib/modules.ts ile aynı sırada). */
export const PLUGINS: readonly AssistantPlugin[] = [fitnessPlugin];
