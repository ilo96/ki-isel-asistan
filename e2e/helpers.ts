import { expect, type Page } from "@playwright/test";

/** Yeni bir kullanıcı kaydeder, onboarding'i geçer ve ana sayfaya gelir. */
export async function registerAndOnboard(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Adın").fill("Deneme Kullanıcı");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill("sifre12345");
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await page.waitForURL(/onboarding/);
  await page.getByRole("button", { name: "Atla" }).click();
  await page.getByRole("button", { name: "Hazırım" }).click();
  await page.waitForURL(/home/);
  await expect(page.getByText("Asistanın özeti")).toBeVisible();
  return email;
}

/** Asistana yazar ve yanıtın bitmesini bekler (mesaj listesi aria-busy="false" olur). */
export async function ask(page: Page, text: string) {
  const input = page.getByLabel("Asistana yaz…");
  const sent = page.locator("ol > li").filter({ hasText: text });
  const before = await sent.count();
  await input.fill(text);
  await input.press("Enter");
  await expect(sent).toHaveCount(before + 1);
  await expect(page.locator('ol[aria-busy="false"]')).toBeVisible({ timeout: 30_000 });
}
