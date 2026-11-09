import { expect, test } from "@playwright/test";

const CASE_SLUG = "conexion-laboral";

function rgbChannels(value: string): number[] | null {
  const match = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function endOfContentReport(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const main = document.querySelector(".work-case__main");
    const asideVisit = document.querySelector(".work-case__visit--aside");
    const buttonVisit = document.querySelector("a.work-case__visit");
    const end = document.querySelector(".work-case__visit-end");
    const link = document.querySelector(".work-case__visit-link");
    const name = document.querySelector(".work-case__name");
    const title = document.querySelector(".work-case__title");
    const lastSection = document.querySelector(
      ".work-case__main > .work-case__section:last-of-type",
    );
    if (
      !(main instanceof HTMLElement) ||
      !(end instanceof HTMLElement) ||
      !(link instanceof HTMLElement) ||
      !(lastSection instanceof HTMLElement) ||
      !(title instanceof HTMLElement)
    ) {
      return null;
    }
    const style = getComputedStyle(link);
    const textProbe = document.createElement("span");
    textProbe.style.color = "var(--neutro-text)";
    document.body.appendChild(textProbe);
    const textColor = getComputedStyle(textProbe).color;
    textProbe.remove();
    const endRect = end.getBoundingClientRect();
    const lastRect = lastSection.getBoundingClientRect();
    const nameRect = name?.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    return {
      mainLastIsEnd: main.lastElementChild === end,
      endAfterLastSection: endRect.top >= lastRect.bottom - 0.5,
      nameBottom: nameRect?.bottom ?? null,
      titleBottom: titleRect.bottom,
      endTop: endRect.top,
      asideCount: asideVisit ? 1 : 0,
      buttonCount: buttonVisit ? 1 : 0,
      endDisplay: getComputedStyle(end).display,
      color: style.color,
      textColor,
      background: style.backgroundColor,
      textDecorationLine: style.textDecorationLine,
      paddingTop: style.paddingTop,
      borderWidth: style.borderTopWidth,
      target: link.getAttribute("target"),
      rel: link.getAttribute("rel"),
      text: (link.textContent ?? "").replace(/\s+/g, " ").trim(),
      visitLinkCount: document.querySelectorAll(".work-case__visit-link")
        .length,
    };
  });
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

  for (const width of [390, 1440] as const) {
    test(`a ${width}px el link cierra el contenido general del caso`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 2400 });
      await page.goto(`/trabajo/afectiva`, {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => document.fonts.ready);

      const report = await endOfContentReport(page);

      expect(report).not.toBeNull();
      if (!report) throw new Error("report ausente");
      expect(report.mainLastIsEnd).toBe(true);
      expect(report.endAfterLastSection).toBe(true);
      expect(report.asideCount).toBe(0);
      expect(report.buttonCount).toBe(0);
      expect(report.visitLinkCount).toBe(1);
      expect(report.endDisplay).not.toBe("none");
      expect(report.endTop).toBeGreaterThan(report.titleBottom + 80);
      if (report.nameBottom !== null) {
        expect(report.endTop).toBeGreaterThan(report.nameBottom + 80);
      }
      expect(report.target).toBe("_blank");
      expect(report.rel).toContain("noopener");
      expect(report.textDecorationLine).toContain("underline");
      expect(report.paddingTop).toBe("0px");
      expect(report.borderWidth).toBe("0px");
      expect(rgbChannels(report.color)).toEqual(rgbChannels(report.textColor));
      expect(report.text.startsWith("Visitar sitio")).toBe(true);
    });
  }

  test("a 390px sin línea oficial el link también cierra el contenido", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 2400 });
    await page.goto(`/trabajo/${CASE_SLUG}`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const report = await endOfContentReport(page);

    expect(report).not.toBeNull();
    if (!report) throw new Error("report ausente");
    expect(report.mainLastIsEnd).toBe(true);
    expect(report.endAfterLastSection).toBe(true);
    expect(report.asideCount).toBe(0);
    expect(report.buttonCount).toBe(0);
    expect(report.endTop).toBeGreaterThan(report.titleBottom + 80);
    expect(report.textDecorationLine).toContain("underline");
  });
});
