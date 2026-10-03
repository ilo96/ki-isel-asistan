import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

/** Ciddi ve kritik erişilebilirlik ihlali olmamalı (plan: WCAG 2.2 AA). */
async function audit(page: Page) {
  // Giriş animasyonları bitsin; yarı saydam ara kareler kontrast hatası üretmesin.
  await page.waitForTimeout(2500);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`erişilebilirlik (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test("herkese açık sayfalar", async ({ page }) => {
      for (const path of ["/", "/login", "/register"]) {
        await page.goto(path);
        await audit(page);
      }
    });

    test("uygulama ekranları", async ({ page }) => {
      await registerAndOnboard(page);
      await page.getByRole("button", { name: "Örnek veriyle dene" }).click();
      await expect(page.getByText("Son işlemler")).toBeVisible();
      for (const path of ["/home", "/finance", "/finance/budgets", "/tasks", "/assistant", "/notifications", "/settings", "/profile"]) {
        await page.goto(path);
        await audit(page);
      }
    });
  });
}
