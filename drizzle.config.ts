import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  // Neon'un havuzsuz (doğrudan) bağlantısı migration için daha güvenli; Vercel'in Neon
  // entegrasyonu onu DATABASE_URL_UNPOOLED olarak ekler.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
