import { expect, test } from "@playwright/test";
import { ask, registerAndOnboard } from "./helpers";

test("tanıtım sayfası kayda götürür", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("asistan");
  await page.getByRole("link", { name: "Ücretsiz başla" }).first().click();
  await expect(page).toHaveURL(/register/);
});

test("asistanla gider ekle, özet sor, geri al", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/assistant");
  await ask(page, "Bugün 350 TL yemek harcadım");
  await expect(page.getByText("Yapıldı").first()).toBeVisible();
  await expect(page).toHaveURL(/\/assistant\/[0-9a-f-]{36}/);

  await ask(page, "Bu ay ne kadar harcadım?");
  await expect(page.getByText(/₺350 harcadın/)).toBeVisible();

  await page.getByRole("button", { name: "Geri al" }).first().click();
  await expect(page.getByText("Geri alındı").first()).toBeVisible();

  // Silme her zaman onay ister.
  await ask(page, "Bugün 120 TL taksi");
  await ask(page, "son harcamayı sil");
  await expect(page.getByText("Onayın bekleniyor")).toBeVisible();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page.getByText("Yapıldı").last()).toBeVisible();
});

test("asistan hatırlatıcı kurar, Görevler'de görünür", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/assistant");
  await ask(page, "Her ayın 5'inde kira hatırlat 25.000 TL");
  await expect(page.getByText(/Kurdum: “Kira”/)).toBeVisible();
  await page.goto("/tasks?tab=upcoming");
  await expect(page.getByText("Kira").first()).toBeVisible();
});

test("hızlı ekle ile gider ve komut paleti araması", async ({ page, isMobile }) => {
  await registerAndOnboard(page);
  await page.getByRole("button", { name: "Örnek veriyle dene" }).click();
  await expect(page.getByText("Son işlemler")).toBeVisible();
  if (!isMobile) {
    await page.keyboard.press("Control+k");
    await page.keyboard.type("market");
    await expect(page.getByRole("option", { name: /Asistana sor/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /market/i }).nth(1)).toBeVisible();
  }
});
