import { expect, test } from "@playwright/test";

test.describe("/contacto", () => {
  test("renderiza título SEO, h1 oculto y canales", async ({ page }) => {
    const response = await page.goto("/contacto");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle("Contacto | Neutro Solutions");
    await expect(page.locator("h1")).toHaveText("Contacto | Neutro Solutions");
    await expect(
      page.getByRole("heading", { name: "Canales de comunicación" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/i })).toHaveAttribute(
      "href",
      "https://wa.me/5493413398851",
    );
    await expect(
      page.getByRole("heading", { name: "Construyamos algo juntos" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /forma de trabajar/i }),
    ).toHaveCount(0);
  });

  test("gating de consentimiento en el botón Enviar", async ({ page }) => {
    await page.goto("/contacto");
    const submit = page.getByRole("button", { name: "Enviar" });
    await expect(submit).toBeDisabled();
    await page.locator("[data-contacto-consent]").check();
    await expect(submit).toBeEnabled();
    await page.locator("[data-contacto-consent]").uncheck();
    await expect(submit).toBeDisabled();
  });

  test("en mobile oculta celdas vacías de la grilla", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contacto");
    const blanks = page.locator(".contacto-channel--blank");
    await expect(blanks).toHaveCount(2);
    for (const blank of await blanks.all()) {
      await expect(blank).toBeHidden();
    }
    const visible = page.locator(
      ".contacto-channel:not(.contacto-channel--blank)",
    );
    await expect(visible).toHaveCount(6);
    for (const cell of await visible.all()) {
      await expect(cell).toBeVisible();
    }
  });

  test("incluye Contacto en nav desktop y drawer mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/contacto");
    await expect(
      page.locator(".site-header__nav").getByRole("link", { name: "Contacto" }),
    ).toHaveAttribute("href", "/contacto");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/contacto");
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(
      page.locator("[data-drawer]").getByRole("link", { name: "Contacto" }),
    ).toHaveAttribute("href", "/contacto");
  });
});
