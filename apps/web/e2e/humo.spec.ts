import { expect, test } from "@playwright/test";

const routes = [
  {
    path: "/",
    title: "Neutro Solutions | Webs, sistemas y automatización con IA",
  },
  {
    path: "/nosotros",
    title: "Nosotros | Neutro Solutions",
  },
] as const;

for (const route of routes) {
  test(`${route.path} carga con título y un h1`, async ({ page }) => {
    const response = await page.goto(route.path);
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(route.title);
    const heading = page.locator("h1");
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
  });
}
