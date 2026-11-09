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

  test("a 390px el link cierra el contenido general del caso", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 2400 });
    await page.goto(`/trabajo/afectiva`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const main = document.querySelector(".work-case__main");
      const asideVisit = document.querySelector(".work-case__visit--aside");
      const end = document.querySelector(".work-case__visit-end");
      const link = document.querySelector(".work-case__visit-link");
      const name = document.querySelector(".work-case__name");
      const lastSection = document.querySelector(
        ".work-case__main > .work-case__section:last-of-type",
      );
      if (
        !(main instanceof HTMLElement) ||
        !(end instanceof HTMLElement) ||
        !(link instanceof HTMLElement) ||
        !(lastSection instanceof HTMLElement)
      ) {
        return null;
      }
      const style = getComputedStyle(link);
      const asideStyle =
        asideVisit instanceof HTMLElement ? getComputedStyle(asideVisit) : null;
      const textProbe = document.createElement("span");
      textProbe.style.color = "var(--neutro-text)";
      document.body.appendChild(textProbe);
      const textColor = getComputedStyle(textProbe).color;
      textProbe.remove();
      const endRect = end.getBoundingClientRect();
      const lastRect = lastSection.getBoundingClientRect();
      const nameRect = name?.getBoundingClientRect();
      return {
        mainLastIsEnd: main.lastElementChild === end,
        endAfterLastSection: endRect.top >= lastRect.bottom - 0.5,
        nameBottom: nameRect?.bottom ?? null,
        endTop: endRect.top,
        asideDisplay: asideStyle?.display ?? null,
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
      };
    });

    expect(report).not.toBeNull();
    if (!report) throw new Error("report ausente");
    expect(report.mainLastIsEnd).toBe(true);
    expect(report.endAfterLastSection).toBe(true);
    expect(report.asideDisplay).toBe("none");
    expect(report.endDisplay).not.toBe("none");
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

  test("a 390px sin línea oficial el link también cierra el contenido", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 2400 });
    await page.goto(`/trabajo/${CASE_SLUG}`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const report = await page.evaluate(() => {
      const main = document.querySelector(".work-case__main");
      const end = document.querySelector(".work-case__visit-end");
      const link = document.querySelector(".work-case__visit-link");
      const title = document.querySelector(".work-case__title");
      const lastSection = document.querySelector(
        ".work-case__main > .work-case__section:last-of-type",
      );
      if (
        !(main instanceof HTMLElement) ||
        !(end instanceof HTMLElement) ||
        !(link instanceof HTMLElement) ||
        !(title instanceof HTMLElement) ||
        !(lastSection instanceof HTMLElement)
      ) {
        return null;
      }
      return {
        mainLastIsEnd: main.lastElementChild === end,
        endAfterLastSection:
          end.getBoundingClientRect().top >=
          lastSection.getBoundingClientRect().bottom - 0.5,
        endTop: end.getBoundingClientRect().top,
        titleBottom: title.getBoundingClientRect().bottom,
        textDecorationLine: getComputedStyle(link).textDecorationLine,
      };
    });

    expect(report).not.toBeNull();
    if (!report) throw new Error("report ausente");
    expect(report.mainLastIsEnd).toBe(true);
    expect(report.endAfterLastSection).toBe(true);
    expect(report.endTop).toBeGreaterThan(report.titleBottom + 80);
    expect(report.textDecorationLine).toContain("underline");
  });

  test("a 1440px el botón del aside queda debajo del título/descripcion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/trabajo/afectiva`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => document.fonts.ready);

    const geometry = await page.evaluate(() => {
      const name = document.querySelector(".work-case__name");
      const visit = document.querySelector(".work-case__visit--aside");
      const end = document.querySelector(".work-case__visit-end");
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
        visitDisplay: style.display,
        endDisplay:
          end instanceof HTMLElement ? getComputedStyle(end).display : null,
        background: style.backgroundColor,
        color: style.color,
        textColor,
        bgColor,
      };
    });

    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error("geometry ausente");
    expect(geometry.visitDisplay).not.toBe("none");
    expect(geometry.endDisplay).toBe("none");
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
