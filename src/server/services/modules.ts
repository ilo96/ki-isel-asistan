import { eq } from "drizzle-orm";
import { MODULE_KEYS, MODULES, type ModuleKey, type ModuleState } from "@/lib/modules";
import type { Db } from "@/server/db/client";
import { userModules } from "@/server/db/schema";

/** Eklenti durumları; satırı olmayan eklenti varsayılanıyla gelir. */
export async function getModuleStates(db: Db, userId: string): Promise<ModuleState[]> {
  const rows = await db.select().from(userModules).where(eq(userModules.userId, userId));
  return MODULE_KEYS.map((key) => {
    const row = rows.find((r) => r.moduleKey === key);
    const def = MODULES[key];
    return {
      key,
      enabled: row?.enabled ?? def.defaultEnabled,
      settings: { ...def.defaultSettings, ...(row?.settings ?? {}) },
    };
  });
}

export async function getModuleState(db: Db, userId: string, key: ModuleKey): Promise<ModuleState> {
  const states = await getModuleStates(db, userId);
  return states.find((s) => s.key === key)!;
}

export async function setModuleState(
  db: Db,
  userId: string,
  key: ModuleKey,
  patch: { enabled?: boolean; settings?: Record<string, unknown> },
) {
  const current = await getModuleState(db, userId, key);
  const enabled = patch.enabled ?? current.enabled;
  const settings = { ...current.settings, ...(patch.settings ?? {}) };
  await db
    .insert(userModules)
    .values({ userId, moduleKey: key, enabled, settings })
    .onConflictDoUpdate({
      target: [userModules.userId, userModules.moduleKey],
      set: { enabled, settings },
    });
}
