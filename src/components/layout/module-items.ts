import { Activity, type LucideIcon } from "lucide-react";
import { MODULES, type ModuleKey } from "@/lib/modules";

/** Eklentilerin gezinme girişi: kenar çubuğunda "Eklentiler" ve komut paletinde görünür. */
export const MODULE_ICONS: Record<ModuleKey, LucideIcon> = {
  fitness: Activity,
};

export const moduleItems = (keys: readonly ModuleKey[]) =>
  keys.map((key) => ({ key, href: MODULES[key].href, icon: MODULE_ICONS[key] }));
