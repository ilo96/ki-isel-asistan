import { PLUGINS } from "./plugins";
import { CORE_TOOLS, type ToolDef } from "./tools";

/** Asistanın tüm araçları: çekirdek + eklentiler. */
export const TOOLS: readonly ToolDef[] = [...CORE_TOOLS, ...PLUGINS.flatMap((p) => p.tools)];

const byName = new Map(TOOLS.map((t) => [t.name, t]));
export const getTool = (name: string) => byName.get(name);
