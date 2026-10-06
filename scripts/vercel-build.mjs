#!/usr/bin/env node
/*
 * Vercel derlemesi: veritabanı bağlıysa önce tabloları günceller (drizzle/ klasöründeki
 * migration'lar), sonra uygulamayı derler. Böylece Neon'u bağlamak yeterli; elle
 * `pnpm db:migrate` çalıştırmak gerekmez.
 */
import { execSync } from "node:child_process";

if (process.env.DATABASE_URL) execSync("drizzle-kit migrate", { stdio: "inherit" });
else console.warn("DATABASE_URL yok; migration atlandı.");
execSync("next build", { stdio: "inherit" });
