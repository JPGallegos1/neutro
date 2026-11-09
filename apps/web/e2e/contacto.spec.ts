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

  test("con reduced-motion el canvas queda estático", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/contacto?static&i=0");
    const canvas = page.locator("#contacto-dots");
    await expect(canvas).toBeVisible();
    const first = await canvas.evaluate((node) => {
      const el = node as HTMLCanvasElement;
      return el.toDataURL();
    });
    await page.waitForTimeout(200);
    const second = await canvas.evaluate((node) => {
      const el = node as HTMLCanvasElement;
      return el.toDataURL();
    });
    expect(second).toBe(first);
  });

  test("si una bandera falla al cargar, el ciclo LED sigue", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.route("**/images/contacto/flags/argentina.svg", (route) =>
      route.abort(),
    );
    await page.goto("/contacto?i=0");
    const canvas = page.locator("#contacto-dots");
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(600);
    const frames: string[] = [];
    for (let n = 0; n < 5; n++) {
      frames.push(
        await canvas.evaluate((node) =>
          (node as HTMLCanvasElement).toDataURL(),
        ),
      );
      await page.waitForTimeout(350);
    }
    expect(pageErrors).toEqual([]);
    expect(new Set(frames).size).toBeGreaterThan(1);
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

  test("muestra éxito o error según la respuesta del API (sin Resend real)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (
        window as Window & {
          turnstile?: {
            reset: () => void;
            getResponse: () => string;
          };
        }
      ).turnstile = {
        reset() {},
        getResponse() {
          return "test-token";
        },
      };
    });

    await page.route("**/api/contacto", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.goto("/contacto");
    await page.locator("#f-nombre").fill("Ana");
    await page.locator("#f-apellido").fill("García");
    await page.locator("#f-empresa").fill("Neutro");
    await page.locator("#f-email").fill("ana@ejemplo.com");
    await page.locator("#f-ciudad").fill("Rosario");
    await page.locator("[data-contacto-consent]").check();
    await page.locator("[data-contacto-submit]").click();
    await expect(page.locator("[data-contacto-success]")).toBeVisible();
    await expect(page.locator("[data-contacto-success]")).toHaveText(
      "Tu consulta fue enviada para su entrega",
    );

    await page.unroute("**/api/contacto");
    await page.route("**/api/contacto", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          errors: [{ field: "_", code: "disabled" }],
        }),
      });
    });
    await page.goto("/contacto");
    await page.locator("#f-nombre").fill("Ana");
    await page.locator("#f-apellido").fill("García");
    await page.locator("#f-empresa").fill("Neutro");
    await page.locator("#f-email").fill("ana@ejemplo.com");
    await page.locator("#f-ciudad").fill("Rosario");
    await page.locator("[data-contacto-consent]").check();
    await page.locator("[data-contacto-submit]").click();
    await expect(page.locator("[data-contacto-error]")).toBeVisible();
    await expect(page.locator("[data-contacto-error]")).toHaveText(
      "No pudimos confirmar el envío. Probá de nuevo o escribinos a hola@neutro.solutions",
    );
  });
});
