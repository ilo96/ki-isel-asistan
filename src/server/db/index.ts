import "server-only";
import { env, isProduction } from "@/server/env";
import { createPgliteDb, createPostgresDb, type Db } from "./client";

export type { Db } from "./client";
export * as tables from "./schema";

/** Geliştirmede DATABASE_URL yoksa veriler bu klasördeki gömülü Postgres'te durur. */
const LOCAL_DATA_DIR = ".data/pglite";

// Dev sunucusu modülleri yeniden yükleyince ikinci bir bağlantı açılmasın.
const globalForDb = globalThis as unknown as { dbPromise?: Promise<Db> };

export function getDb(): Promise<Db> {
  // Açılış başarısız olursa bir sonraki istek yeniden denesin.
  globalForDb.dbPromise ??= open().catch((error: unknown) => {
    globalForDb.dbPromise = undefined;
    throw error;
  });
  return globalForDb.dbPromise;
}

async function open(): Promise<Db> {
  const { DATABASE_URL } = env();
  if (DATABASE_URL) return createPostgresDb(DATABASE_URL);
  if (isProduction()) throw new Error("Production ortamında DATABASE_URL zorunlu.");
  return createPgliteDb(LOCAL_DATA_DIR);
}
