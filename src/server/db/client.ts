import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/*
 * Veritabanı bağlantısı. server-only içermez ki testler de aynı fabrikayı kullanabilsin;
 * uygulama kodu bunu doğrudan değil, `@/server/db` üzerinden kullanır.
 */

/** Postgres (Neon) ve PGlite sürücülerinin ortak tipi; servisler hangisi olduğunu bilmez. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_FOLDER = "drizzle";

export function createPostgresDb(url: string): Db {
  const client = postgres(url, { prepare: false, max: 5 });
  return drizzlePostgres(client, { schema });
}

/** dataDir verilmezse bellekte çalışır (testler için). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
