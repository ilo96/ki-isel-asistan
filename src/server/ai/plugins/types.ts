import type { ModuleKey } from "@/lib/modules";
import type { EngineInput } from "../engine";
import type { ToolDef } from "../tools";

/**
 * Asistan eklentisi: kendi araçları, sistem istemine eklenen kuralları ve anahtar yokken
 * çalışan Türkçe ayrıştırıcısı. Çevrimdışı işleyici mesaj kendisine ait değilse null döner;
 * aitse yanıtı kendisi verir ve önerileri döndürür.
 */
export type AssistantPlugin = {
  module: ModuleKey;
  tools: readonly ToolDef[];
  prompt: string;
  offline?: (input: EngineInput) => Promise<readonly string[] | null>;
};
