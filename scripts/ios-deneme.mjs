#!/usr/bin/env node
/*
 * iPhone'da ücretsiz Apple hesabıyla deneme kurulumu (Mac'te çalışır):
 *   pnpm ios:deneme https://proje-adi.vercel.app
 * Uygulamayı verilen sunucuya bağlar, Personal Team ayarını yazar ve Xcode'u açar.
 * Mağaza ayarına dönmek için: pnpm ios:deneme --kapat
 */
import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const file = new URL("../ios/deneme.xcconfig", import.meta.url);
const arg = process.argv[2];

if (arg === "--kapat") {
  rmSync(file, { force: true });
  execSync("npx cap sync ios", { stdio: "inherit" });
  console.log("Deneme ayarı kaldırıldı; uygulama yine app.vantrelcode.com'u açar.");
  process.exit(0);
}

let url;
try {
  url = new URL(arg ?? "");
} catch {
  console.error("Sunucu adresini ver: pnpm ios:deneme https://proje-adi.vercel.app");
  process.exit(1);
}

writeFileSync(
  file,
  [
    "// pnpm ios:deneme yazdı. Ücretsiz Apple hesabı için; git'e girmez.",
    "VANTREL_BUNDLE_ID = com.vantrelcode.app.deneme",
    "VANTREL_ENTITLEMENTS = App/Deneme.entitlements",
    "",
  ].join("\n"),
);
execSync("npx cap sync ios", { stdio: "inherit", env: { ...process.env, VANTREL_APP_URL: url.origin } });
console.log(`\nUygulama ${url.origin} adresini açacak. Xcode açılıyor...`);
execSync("npx cap open ios", { stdio: "inherit" });
