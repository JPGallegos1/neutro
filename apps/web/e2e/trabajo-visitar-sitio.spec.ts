import { expect, test } from "@playwright/test";

const CASE_SLUG = "conexion-laboral";

function rgbChannels(value: string): number[] | null {
  const match = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test.describe("CTA Visitar sitio en fichas /trabajo", () => {
  test("no renderiza el chip En producción en listing ni ficha", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("En producción")).toHaveCount(0);
    await expect(page.locator(".work-card__tag")).toHaveCount(0);

    await page.goto(`/trabajo/${CASE_SLUG}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("En producción")).toHaveCount(0);
    await expect(page.locator(".work-case__tag")).toHaveCount(0);
  });

  test("a 390px queda a la derecha de la descripción", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/trabajo/afectiva`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => {
      const title = document.querySelector(".work-case__title");
      const name = document.querySelector(".work-case__name");
      const visit = document.querySelector(".work-case__visit");
      if (
        !(title instanceof HTMLElement) ||
        !(name instanceof HTMLElement) ||
        !(visit instanceof HTMLElement)
      ) {
        return null;
      }
      const titleRect = title.getBoundingClientRect();
      const nameRect = name.getBoundingClientRect();
      const visitRect = visit.getBoundingClientRect();
      return {
        titleBottom: titleRect.bottom,
        nameRight: nameRect.right,
        nameBottom: nameRect.bottom,
        visitLeft: visitRect.left,
        visitTop: visitRect.top,
      };
    });

    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error("geometry ausente");
    expect(geometry.visitLeft).toBeGreaterThan(geometry.nameRight - 0.5);
    expect(geometry.visitTop).toBeGreaterThanOrEqual(geometry.titleBottom - 1);
    expect(geometry.visitTop).toBeLessThan(geometry.nameBottom + 1);
  });

  test("a 390px sin línea oficial el CTA queda a la derecha bajo el título", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/trabajo/${CASE_SLUG}`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => {
      const title = document.querySelector(".work-case__title");
      const visit = document.querySelector(".work-case__visit");
      const aside = document.querySelector(".work-case__aside");
      if (
        !(title instanceof HTMLElement) ||
        !(visit instanceof HTMLElement) ||
        !(aside instanceof HTMLElement)
      ) {
        return null;
      }
      const titleRect = title.getBoundingClientRect();
      const visitRect = visit.getBoundingClientRect();
      const asideRect = aside.getBoundingClientRect();
      return {
        titleBottom: titleRect.bottom,
        visitTop: visitRect.top,
        visitLeft: visitRect.left,
        visitRight: visitRect.right,
        asideRight: asideRect.right,
        asideMid: (asideRect.left + asideRect.right) / 2,
      };
    });

    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error("geometry ausente");
    expect(geometry.visitTop).toBeGreaterThan(geometry.titleBottom - 0.5);
    expect(geometry.visitLeft).toBeGreaterThan(geometry.asideMid);
    expect(geometry.asideRight - geometry.visitRight).toBeLessThanOrEqual(1);
  });

  test("a 1440px el CTA queda debajo del título/descripcion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/trabajo/afectiva`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => {
      const name = document.querySelector(".work-case__name");
      const visit = document.querySelector(".work-case__visit");
      if (!(name instanceof HTMLElement) || !(visit instanceof HTMLElement)) {
        return null;
      }
      const nameRect = name.getBoundingClientRect();
      const visitRect = visit.getBoundingClientRect();
      return {
        nameBottom: nameRect.bottom,
        nameLeft: nameRect.left,
        visitTop: visitRect.top,
        visitLeft: visitRect.left,
      };
    });

    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error("geometry ausente");
    expect(geometry.visitTop).toBeGreaterThan(geometry.nameBottom - 0.5);
    expect(
      Math.abs(geometry.visitLeft - geometry.nameLeft),
    ).toBeLessThanOrEqual(1);
  });

  test("usa fondo/texto monocromos en claro y oscuro", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((value: string) => {
        localStorage.setItem("neutro-theme", value);
      }, theme);
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`/trabajo/${CASE_SLUG}`, {
        waitUntil: "domcontentloaded",
      });

      const colors = await page.evaluate(() => {
        const visit = document.querySelector(".work-case__visit");
        if (!(visit instanceof HTMLElement)) return null;
        const style = getComputedStyle(visit);
        const textProbe = document.createElement("span");
        textProbe.style.color = "var(--neutro-text)";
        document.body.appendChild(textProbe);
        const textColor = getComputedStyle(textProbe).color;
        textProbe.remove();
        const bgProbe = document.createElement("span");
        bgProbe.style.color = "var(--neutro-bg)";
        document.body.appendChild(bgProbe);
        const bgColor = getComputedStyle(bgProbe).color;
        bgProbe.remove();
        return {
          background: style.backgroundColor,
          color: style.color,
          textColor,
          bgColor,
        };
      });

      expect(colors).not.toBeNull();
      if (!colors) throw new Error("colors ausente");
      expect(rgbChannels(colors.background)).toEqual(
        rgbChannels(colors.textColor),
      );
      expect(rgbChannels(colors.color)).toEqual(rgbChannels(colors.bgColor));
    }
  });
});
