import { expect, test } from "@playwright/test";

const pages = [
  {
    path: "/web",
    title: "Diseño web en Rosario para negocios | Neutro Solutions",
    h1: "Diseño web en Rosario para que te elijan antes de preguntar",
    related: "/automatizacion-ia",
    hasCases: true,
  },
  {
    path: "/automatizacion-ia",
    title: "Automatización con IA y bots de WhatsApp | Neutro Solutions",
    h1: "Automatización con IA para que lo que hacés a mano funcione solo",
    related: "/web",
    hasCases: false,
  },
] as const;

for (const route of pages) {
  test.describe(route.path, () => {
    test("carga con título, un H1 y sin FAQ ni Cómo trabajamos", async ({
      page,
    }) => {
      const response = await page.goto(route.path);
      expect(response?.ok()).toBe(true);
      await expect(page).toHaveTitle(route.title);
      const heading = page.locator("h1");
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveText(route.h1);
      await expect(
        page.getByRole("heading", { name: "Cómo trabajamos" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Preguntas frecuentes" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "También te puede servir" }),
      ).toBeVisible();
      await expect(page.locator("a.service-cta")).toHaveCount(0);
      await expect(page.locator(".service-close")).toHaveCount(0);
      await expect(page.getByText("Escribinos", { exact: true })).toHaveCount(
        0,
      );
    });

    test("enlaces internos relativos válidos", async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator("a.service-rel__link")).toHaveAttribute(
        "href",
        route.related,
      );
      if (route.hasCases) {
        const tiles = page.locator("a.service-tile");
        await expect(tiles).toHaveCount(4);
        for (const tile of await tiles.all()) {
          const href = await tile.getAttribute("href");
          expect(href).toMatch(/^\/trabajo\/[a-z0-9-]+$/);
        }
        await expect(
          page.locator('a.service-tile[href="/trabajo/luxurycars"]'),
        ).toHaveCount(0);
      } else {
        await expect(page.locator("a.service-tile")).toHaveCount(0);
      }
    });
  });
}

test("/contacto?origen=/web canónica a /contacto y completa origen", async ({
  page,
}) => {
  await page.goto("/contacto?origen=/web");
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute(
    "href",
    "https://neutro.solutions/contacto",
  );
  await expect(page.locator("[data-contacto-origen]")).toHaveValue("/web");
});
