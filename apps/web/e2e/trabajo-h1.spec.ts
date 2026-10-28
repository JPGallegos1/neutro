import { expect, test } from "@playwright/test";

const CASES = [
  {
    slug: "conexion-laboral",
    h1: "CONEXIÓN LABORAL",
  },
  {
    slug: "afectiva",
    h1: "AFECTIVA",
  },
  {
    slug: "capa-automotores",
    h1: "CAPA",
  },
  {
    slug: "suplementacion-ciencia",
    h1: "SCC",
  },
  {
    slug: "luxurycars",
    h1: "LUXURY CARS",
  },
] as const;

const VIEWPORTS = [320, 360, 390, 768, 1024, 1440] as const;
const MOBILE_MAX_PX = 48;
const DESKTOP_MAX_PX = 104;
const FONT_TOLERANCE = 0.75;

type H1Report = {
  text: string;
  fontSize: number;
  fontWeight: string;
  overflowWrap: string;
  wordBreak: string;
  midWordBreaks: { word: string; lines: number }[];
  lineCount: number;
};

async function measureH1(
  page: import("@playwright/test").Page,
  slug: string,
  width: number,
): Promise<H1Report> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/trabajo/${slug}`, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    const title = document.querySelector(".work-case__title");
    if (!(title instanceof HTMLElement)) {
      return {
        text: "",
        fontSize: 0,
        fontWeight: "",
        overflowWrap: "",
        wordBreak: "",
        midWordBreaks: [],
        lineCount: 0,
      };
    }
    const style = getComputedStyle(title);
    const text = (title.textContent ?? "").replace(/\s+/g, " ").trim();
    const midWordBreaks: { word: string; lines: number }[] = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const raw = node.textContent ?? "";
      for (const match of raw.matchAll(/[^\s-]+/g)) {
        const word = match[0];
        if (word.length < 2) continue;
        const start = match.index ?? 0;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + word.length);
        const tops = new Set(
          [...range.getClientRects()]
            .filter((r) => r.width > 0.5)
            .map((r) => Math.round(r.top)),
        );
        if (tops.size > 1) {
          midWordBreaks.push({ word, lines: tops.size });
        }
      }
      node = walker.nextNode();
    }
    const lineTops = new Set(
      [...title.getClientRects()]
        .filter((r) => r.height > 0.5)
        .map((r) => Math.round(r.top)),
    );
    const lineEls = [...title.querySelectorAll(".work-case__title-line")];
    const wrapSample =
      lineEls[0] instanceof HTMLElement
        ? getComputedStyle(lineEls[0]).overflowWrap
        : style.overflowWrap;
    return {
      text,
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
      overflowWrap: wrapSample,
      wordBreak: style.wordBreak,
      midWordBreaks,
      lineCount: Math.max(lineTops.size, lineEls.length),
    };
  });
}

test.describe("H1 de fichas /trabajo — títulos cortos v34", () => {
  for (const width of VIEWPORTS) {
    for (const item of CASES) {
      test(`/trabajo/${item.slug} a ${width}px: texto corto, sin mid-word, tipografía v34`, async ({
        page,
      }) => {
        const report = await measureH1(page, item.slug, width);
        expect(report.text.toLocaleUpperCase("es-AR")).toBe(item.h1);
        expect(
          report.midWordBreaks,
          `palabras partidas: ${JSON.stringify(report.midWordBreaks)}`,
        ).toEqual([]);
        expect(
          report.overflowWrap,
          "overflow-wrap anywhere/break-word permitiría partir palabras",
        ).toBe("normal");
        expect(Number.parseInt(report.fontWeight, 10)).toBeGreaterThanOrEqual(
          700,
        );
        if (width < 1024) {
          expect(report.fontSize).toBeLessThanOrEqual(
            MOBILE_MAX_PX + FONT_TOLERANCE,
          );
          expect(report.fontSize).toBeGreaterThanOrEqual(
            MOBILE_MAX_PX - FONT_TOLERANCE,
          );
        } else {
          expect(report.fontSize).toBeLessThanOrEqual(
            DESKTOP_MAX_PX + FONT_TOLERANCE,
          );
          expect(
            report.fontSize,
            `desktop a ${width}px quedó en ${report.fontSize}px; el clamp v34 debe superar el piso mobile`,
          ).toBeGreaterThan(MOBILE_MAX_PX + 4);
        }
      });
    }
  }

  test("a 1440px el H1 se acerca al tope desktop del diseño (no queda en el piso mobile)", async ({
    page,
  }) => {
    const report = await measureH1(page, "afectiva", 1440);
    expect(report.fontSize).toBeGreaterThan(80);
    expect(report.fontSize).toBeLessThanOrEqual(DESKTOP_MAX_PX + FONT_TOLERANCE);
  });
});
