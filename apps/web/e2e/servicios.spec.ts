import { expect, test } from "@playwright/test";

const pages = [
  {
    path: "/web",
    title: "Diseño web en Rosario para negocios | Neutro Solutions",
    h1: "Diseño web en Rosario para que te elijan antes de preguntar",
    origen: "/web",
    related: "/automatizacion-ia",
    hasCases: true,
  },
  {
    path: "/automatizacion-ia",
    title: "Automatización con IA y bots de WhatsApp | Neutro Solutions",
    h1: "Automatización con IA para que lo que hacés a mano funcione solo",
    origen: "/automatizacion-ia",
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
    });

    test("CTAs monocromos apuntan a contacto con origen", async ({ page }) => {
      await page.goto(route.path);
      const ctas = page.locator("a.service-cta");
      await expect(ctas).toHaveCount(2);
      const expectedHref = `/contacto?origen=${route.origen}`;
      for (const cta of await ctas.all()) {
        await expect(cta).toHaveAttribute("href", expectedHref);
        await expect(cta).toHaveAttribute("data-origen", route.origen);
        await expect(cta).toHaveCSS("background-color", "rgb(255, 255, 255)");
        await expect(cta).toHaveCSS("color", "rgb(10, 10, 10)");
      }
    });

    test("enlaces internos relativos válidos", async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator("a.service-rel__link")).toHaveAttribute(
        "href",
        route.related,
      );
      if (route.hasCases) {
        const tiles = page.locator("a.service-tile");
        await expect(tiles).toHaveCount(5);
        for (const tile of await tiles.all()) {
          const href = await tile.getAttribute("href");
          expect(href).toMatch(/^\/trabajo\/[a-z0-9-]+$/);
        }
        await expect(
          page.locator('a.service-tile[href="/trabajo/luxurycars"]'),
        ).toHaveCount(1);
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
