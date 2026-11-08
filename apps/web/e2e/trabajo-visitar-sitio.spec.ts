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

  test("a 390px es un link de texto inline al final de la descripción", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/trabajo/afectiva`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const name = document.querySelector(".work-case__name");
      const visit = document.querySelector(".work-case__visit");
      if (!(name instanceof HTMLElement) || !(visit instanceof HTMLElement)) {
        return null;
      }
      const nameRect = name.getBoundingClientRect();
      const visitRect = visit.getBoundingClientRect();
      const style = getComputedStyle(visit);
      const textProbe = document.createElement("span");
      textProbe.style.color = "var(--neutro-text)";
      document.body.appendChild(textProbe);
      const textColor = getComputedStyle(textProbe).color;
      textProbe.remove();
      return {
        nameRight: nameRect.right,
        nameTop: nameRect.top,
        nameBottom: nameRect.bottom,
        visitLeft: visitRect.left,
        visitTop: visitRect.top,
        visitBottom: visitRect.bottom,
        color: style.color,
        textColor,
        background: style.backgroundColor,
        textDecorationLine: style.textDecorationLine,
        paddingTop: style.paddingTop,
        borderWidth: style.borderTopWidth,
        target: visit.getAttribute("target"),
        rel: visit.getAttribute("rel"),
      };
    });

    expect(report).not.toBeNull();
    if (!report) throw new Error("report ausente");
    expect(report.target).toBe("_blank");
    expect(report.rel).toContain("noopener");
    expect(report.textDecorationLine).toContain("underline");
    expect(report.paddingTop).toBe("0px");
    expect(report.borderWidth).toBe("0px");
    expect(rgbChannels(report.color)).toEqual(rgbChannels(report.textColor));
    expect(report.visitLeft).toBeGreaterThan(report.nameRight - 0.5);
    expect(report.visitTop).toBeGreaterThanOrEqual(report.nameTop - 1);
    expect(report.visitTop).toBeLessThan(report.nameBottom + 1);
  });

  test("a 390px sin línea oficial el link queda debajo del título", async ({
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
      if (!(title instanceof HTMLElement) || !(visit instanceof HTMLElement)) {
        return null;
      }
      const titleRect = title.getBoundingClientRect();
      const visitRect = visit.getBoundingClientRect();
      const style = getComputedStyle(visit);
      return {
        titleBottom: titleRect.bottom,
        titleLeft: titleRect.left,
        visitTop: visitRect.top,
        visitLeft: visitRect.left,
        textDecorationLine: style.textDecorationLine,
      };
    });

    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error("geometry ausente");
    expect(geometry.visitTop).toBeGreaterThan(geometry.titleBottom - 0.5);
    expect(
      Math.abs(geometry.visitLeft - geometry.titleLeft),
    ).toBeLessThanOrEqual(1);
    expect(geometry.textDecorationLine).toContain("underline");
  });

  test("a 1440px el CTA botón queda debajo del título/descripcion", async ({
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
        nameBottom: nameRect.bottom,
        nameLeft: nameRect.left,
        visitTop: visitRect.top,
        visitLeft: visitRect.left,
        background: style.backgroundColor,
        color: style.color,
        textColor,
        bgColor,
      };
    });

    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error("geometry ausente");
    expect(geometry.visitTop).toBeGreaterThan(geometry.nameBottom - 0.5);
    expect(
      Math.abs(geometry.visitLeft - geometry.nameLeft),
    ).toBeLessThanOrEqual(1);
    expect(rgbChannels(geometry.background)).toEqual(
      rgbChannels(geometry.textColor),
    );
    expect(rgbChannels(geometry.color)).toEqual(rgbChannels(geometry.bgColor));
  });
});
