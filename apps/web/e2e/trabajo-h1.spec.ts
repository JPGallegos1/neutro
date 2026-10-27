import { expect, test } from "@playwright/test";

const CASES = [
  "conexion-laboral",
  "afectiva",
  "capa-automotores",
  "suplementacion-ciencia",
  "luxurycars",
] as const;

test.describe("H1 de fichas /trabajo según diseño (máx. 48 / 104)", () => {
  test("en móvil el H1 no supera 48px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trabajo/afectiva", { waitUntil: "domcontentloaded" });
    const fontSize = await page.locator(".work-case__title").evaluate((el) => {
      return Number.parseFloat(getComputedStyle(el).fontSize);
    });
    expect(fontSize).toBeLessThanOrEqual(48.5);
    expect(fontSize).toBeGreaterThanOrEqual(40);
  });

  test("en desktop el H1 no supera 104px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/trabajo/afectiva", { waitUntil: "domcontentloaded" });
    const fontSize = await page.locator(".work-case__title").evaluate((el) => {
      return Number.parseFloat(getComputedStyle(el).fontSize);
    });
    expect(fontSize).toBeLessThanOrEqual(104.5);
  });

  for (const slug of CASES) {
    test(`líneas del H1 en /trabajo/${slug} no desbordan el aside (scrollWidth)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(`/trabajo/${slug}`, { waitUntil: "domcontentloaded" });
      const overflows = await page.evaluate(() => {
        return [...document.querySelectorAll(".work-case__title-line")].map(
          (line) => {
            const el = line as HTMLElement;
            return {
              text: el.textContent?.trim() ?? "",
              overflow: el.scrollWidth - el.clientWidth,
              wrap: getComputedStyle(el).overflowWrap,
            };
          },
        );
      });
      for (const row of overflows) {
        expect(row.wrap).toBe("anywhere");
        expect(row.overflow, JSON.stringify(row)).toBeLessThanOrEqual(1);
      }
    });
  }
});
