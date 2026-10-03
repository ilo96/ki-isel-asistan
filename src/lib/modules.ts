import { DEFAULT_FITNESS_SETTINGS } from "@/lib/validation/fitness";

/*
 * Kişisel asistanın eklentileri. Her eklenti kendi ekranını, asistan araçlarını ve
 * bildirimlerini getirir; uygulamanın geri kalanı yalnızca bu listeyi tanır. Yeni bir
 * eklenti buraya bir satır, src/server/ai/plugins'e bir dosya ve kendi features klasörüyle gelir.
 */

export const MODULE_KEYS = ["fitness"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleDef = {
  key: ModuleKey;
  href: `/${string}`;
  /** Kullanıcı hiç dokunmadıysa açık mı. */
  defaultEnabled: boolean;
  defaultSettings: Record<string, unknown>;
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  fitness: {
    key: "fitness",
    href: "/fitness",
    defaultEnabled: true,
    defaultSettings: DEFAULT_FITNESS_SETTINGS,
  },
};

export type ModuleState = { key: ModuleKey; enabled: boolean; settings: Record<string, unknown> };

export const isModuleKey = (v: string): v is ModuleKey =>
  (MODULE_KEYS as readonly string[]).includes(v);
