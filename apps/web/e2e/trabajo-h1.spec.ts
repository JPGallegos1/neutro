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
const MOBILE_FLOOR_PX = 40;
const MOBILE_MAX_PX = 48;
const DESKTOP_FLOOR_PX = 48;
const DESKTOP_MAX_PX = 104;
const CQI_FACTOR = 0.18;
const FONT_TOLERANCE = 1;
const OVERFLOW_TOLERANCE = 1;

const ANCHORED_FONT_PX = {
  320: 48,
  360: 48,
  390: 48,
  768: 48,
  1024: 57.66,
  1440: 85.95,
} as const;

type H1Report = {
  text: string;
  fontSize: number;
  fontWeight: string;
  overflowWrap: string;
  wordBreak: string;
  midWordBreaks: { word: string; lines: number }[];
  lineCount: number;
  cqi: number;
  scrollWidth: number;
  clientWidth: number;
  titleLeft: number;
  titleRight: number;
  asideLeft: number;
  asideRight: number;
  lineOverflows: { text: string; scrollWidth: number; clientWidth: number }[];
};

function expectedFontFromCqi(width: number, cqi: number): number {
  if (width < 1024) {
    return Math.min(MOBILE_MAX_PX, Math.max(MOBILE_FLOOR_PX, cqi * CQI_FACTOR));
  }
  return Math.min(
    DESKTOP_MAX_PX,
    Math.max(DESKTOP_FLOOR_PX, cqi * CQI_FACTOR),
  );
}

async function measureH1(
  page: import("@playwright/test").Page,
  slug: string,
  width: number,
): Promise<H1Report> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/trabajo/${slug}`, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    const title = document.querySelector(".work-case__title");
    const aside = document.querySelector(".work-case__aside");
    if (!(title instanceof HTMLElement) || !(aside instanceof HTMLElement)) {
      return {
        text: "",
        fontSize: 0,
        fontWeight: "",
        overflowWrap: "",
        wordBreak: "",
        midWordBreaks: [],
        lineCount: 0,
        cqi: 0,
        scrollWidth: 0,
        clientWidth: 0,
        titleLeft: 0,
        titleRight: 0,
        asideLeft: 0,
        asideRight: 0,
        lineOverflows: [],
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
    const lineOverflows = lineEls.flatMap((el) => {
      if (!(el instanceof HTMLElement)) return [];
      if (el.scrollWidth <= el.clientWidth + 0.5) return [];
      return [
        {
          text: (el.textContent ?? "").trim(),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        },
      ];
    });
    const titleRect = title.getBoundingClientRect();
    const asideRect = aside.getBoundingClientRect();
    return {
      text,
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: style.fontWeight,
      overflowWrap: wrapSample,
      wordBreak: style.wordBreak,
      midWordBreaks,
      lineCount: Math.max(lineTops.size, lineEls.length),
      cqi: asideRect.width,
      scrollWidth: title.scrollWidth,
      clientWidth: title.clientWidth,
      titleLeft: titleRect.left,
      titleRight: titleRect.right,
      asideLeft: asideRect.left,
      asideRight: asideRect.right,
      lineOverflows,
    };
  });
}

test.describe("H1 de fichas /trabajo — títulos cortos v34", () => {
  for (const width of VIEWPORTS) {
    for (const item of CASES) {
      test(`/trabajo/${item.slug} a ${width}px: texto corto, sin mid-word, tipografía anclada, sin desborde`, async ({
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

        expect(
          report.scrollWidth,
          `H1 scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`,
        ).toBeLessThanOrEqual(report.clientWidth + OVERFLOW_TOLERANCE);
        expect(
          report.lineOverflows,
          `líneas con scroll overflow: ${JSON.stringify(report.lineOverflows)}`,
        ).toEqual([]);
        expect(
          report.titleLeft,
          `H1 left ${report.titleLeft} sale del aside (${report.asideLeft})`,
        ).toBeGreaterThanOrEqual(report.asideLeft - OVERFLOW_TOLERANCE);
        expect(
          report.titleRight,
          `H1 right ${report.titleRight} sale del aside (${report.asideRight})`,
        ).toBeLessThanOrEqual(report.asideRight + OVERFLOW_TOLERANCE);

        const anchored = ANCHORED_FONT_PX[width];
        expect(
          report.fontSize,
          `fuente a ${width}px=${report.fontSize}; ancla medida ${anchored}`,
        ).toBeGreaterThanOrEqual(anchored - FONT_TOLERANCE);
        expect(
          report.fontSize,
          `fuente a ${width}px=${report.fontSize}; ancla medida ${anchored}`,
        ).toBeLessThanOrEqual(anchored + FONT_TOLERANCE);

        const fromCqi = expectedFontFromCqi(width, report.cqi);
        expect(
          report.fontSize,
          `fuente=${report.fontSize}; clamp(…, ${CQI_FACTOR}*cqi=${report.cqi}, …) ⇒ ${fromCqi}`,
        ).toBeGreaterThanOrEqual(fromCqi - FONT_TOLERANCE);
        expect(
          report.fontSize,
          `fuente=${report.fontSize}; clamp(…, ${CQI_FACTOR}*cqi=${report.cqi}, …) ⇒ ${fromCqi}`,
        ).toBeLessThanOrEqual(fromCqi + FONT_TOLERANCE);
      });
    }
  }
});
