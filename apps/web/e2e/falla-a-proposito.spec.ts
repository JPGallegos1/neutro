import { expect, test } from "@playwright/test";

test("falla a propósito para el artefacto", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.locator("h1")).toHaveText("esto no está en la home");
});
