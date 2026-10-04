import { defineConfig, devices } from "@playwright/test";

/*
 * Uçtan uca testler. BASE_URL verilirse çalışan sunucu kullanılır; yoksa geliştirme
 * sunucusu açılır (gömülü veritabanıyla, hiçbir anahtar gerekmeden).
 */
const PORT = 3200;
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, locale: "tr-TR", timezoneId: "Europe/Istanbul", trace: "retain-on-failure" },
  projects: [
    { name: "mobil", use: { ...devices["Pixel 7"] } },
    { name: "masaustu", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm dev -p ${PORT}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: { BETTER_AUTH_URL: baseURL, AUTH_RATE_LIMIT: "0" },
      },
});
