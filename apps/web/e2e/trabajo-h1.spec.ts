import { expect, test } from "@playwright/test";

const CASES = [
  {
    slug: "conexion-laboral",
    h1: "CONEXIÓN LABORAL",
    officialName: "Conexión Laboral",
    officialLine: null,
  },
  {
    slug: "afectiva",
    h1: "AFECTIVA",
    officialName: "Afectiva Comunicaciones",
    officialLine: "Afectiva Comunicaciones",
  },
  {
    slug: "capa-automotores",
    h1: "CAPA",
    officialName: "Capa Automotores",
    officialLine: "Capa Automotores",
  },
  {
    slug: "suplementacion-ciencia",
    h1: "SCC",
    officialName: "Suplementación con Ciencia",
    officialLine: "Suplementación con Ciencia (SCC)",
  },
  {
    slug: "luxurycars",
    h1: "LUXURY CARS",
    officialName: "Luxury Cars",
    officialLine: null,
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
const LINE_HEIGHT = 0.93;
const LETTER_SPACING_EM = -0.04;
const STYLE_TOLERANCE = 0.005;
const NAME_LINE_LETTER_SPACING_EM = -0.01;
const NAME_LINE_LINE_HEIGHT = 1.3;
const NAME_LINE_MARGIN_TOP_PX = -16;
const NAME_LINE_FONT_MOBILE_PX = 16;
const NAME_LINE_FONT_DESKTOP_PX = 20;
const NAME_LINE_WEIGHT = "500";

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
  h1Count: number;
  fontSize: number;
  fontWeight: string;
  lineHeightRatio: number;
  letterSpacingEm: number;
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
  creativeWorkName: string | null;
  officialLine: {
    text: string;
    nextToH1: boolean;
    visible: boolean;
    srOnly: boolean;
    count: number;
    clientId: string | null;
    inAside: boolean;
    overflow: number;
    asideOverflow: number;
    fontSize: number;
    fontWeight: string;
    lineHeightRatio: number;
    lineHeightPx: number;
    letterSpacingEm: number;
    textTransform: string;
    color: string;
    mutedColor: string;
    marginTopPx: number;
    lineCount: number;
  } | null;
  articleLabelledBy: string | null;
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
    const empty: H1Report = {
      text: "",
      h1Count: document.querySelectorAll("h1").length,
      fontSize: 0,
      fontWeight: "",
      lineHeightRatio: 0,
      letterSpacingEm: 0,
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
      creativeWorkName: null,
      officialLine: null,
      articleLabelledBy: null,
    };
    if (!(title instanceof HTMLElement) || !(aside instanceof HTMLElement)) {
      return empty;
    }
    const style = getComputedStyle(title);
    const fontSize = Number.parseFloat(style.fontSize);
    const lineHeightPx = Number.parseFloat(style.lineHeight);
    const letterSpacingPx = Number.parseFloat(style.letterSpacing);
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
    let creativeWorkName: string | null = null;
    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        const nodes = Array.isArray(data)
          ? data
          : Array.isArray(data?.["@graph"])
            ? data["@graph"]
            : [data];
        for (const node of nodes) {
          if (
            node &&
            typeof node === "object" &&
            node["@type"] === "CreativeWork" &&
            typeof node.name === "string"
          ) {
            creativeWorkName = node.name;
          }
        }
      } catch {
        continue;
      }
    }
    const article = document.querySelector("article.work-case");
    const officialNodes = [
      ...document.querySelectorAll("p.work-case__name"),
    ];
    const next = title.nextElementSibling;
    const officialEl =
      next instanceof HTMLParagraphElement &&
      next.classList.contains("work-case__name")
        ? next
        : null;
    const officialStyle = officialEl ? getComputedStyle(officialEl) : null;
    const officialRect = officialEl?.getBoundingClientRect();
    const officialFontSize = officialStyle
      ? Number.parseFloat(officialStyle.fontSize)
      : 0;
    const officialLineHeightPx = officialStyle
      ? Number.parseFloat(officialStyle.lineHeight)
      : 0;
    const officialLetterSpacingPx = officialStyle
      ? Number.parseFloat(officialStyle.letterSpacing)
      : 0;
    const mutedProbe = document.createElement("span");
    mutedProbe.style.color = "var(--neutro-text-muted)";
    document.body.appendChild(mutedProbe);
    const mutedColor = getComputedStyle(mutedProbe).color;
    mutedProbe.remove();
    const officialLineTops =
      officialEl === null
        ? []
        : [
            ...new Set(
              [...officialEl.getClientRects()]
                .filter((r) => r.height > 0.5)
                .map((r) => Math.round(r.top)),
            ),
          ];
    const officialLine =
      officialNodes.length === 0
        ? null
        : {
            text: (officialEl?.textContent ?? officialNodes[0]?.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim(),
            nextToH1: officialEl !== null,
            visible:
              officialEl !== null &&
              officialStyle !== null &&
              officialStyle.display !== "none" &&
              officialStyle.visibility !== "hidden" &&
              Number.parseFloat(officialStyle.opacity || "1") > 0.01 &&
              officialEl.getClientRects().length > 0,
            srOnly: officialEl?.classList.contains("sr-only") ?? false,
            count: officialNodes.length,
            clientId: officialEl?.id ?? null,
            inAside: officialEl !== null && aside.contains(officialEl),
            overflow: officialEl
              ? officialEl.scrollWidth - officialEl.clientWidth
              : 0,
            asideOverflow:
              officialRect !== undefined
                ? Math.max(0, officialRect.right - asideRect.right)
                : 0,
            fontSize: officialFontSize,
            fontWeight: officialStyle?.fontWeight ?? "",
            lineHeightRatio:
              officialFontSize > 0 ? officialLineHeightPx / officialFontSize : 0,
            lineHeightPx: officialLineHeightPx,
            letterSpacingEm:
              officialFontSize > 0
                ? officialLetterSpacingPx / officialFontSize
                : 0,
            textTransform: officialStyle?.textTransform ?? "",
            color: officialStyle?.color ?? "",
            mutedColor,
            marginTopPx: officialStyle
              ? Number.parseFloat(officialStyle.marginTop)
              : 0,
            lineCount: officialLineTops.length,
          };
    return {
      text,
      h1Count: document.querySelectorAll("h1").length,
      fontSize,
      fontWeight: style.fontWeight,
      lineHeightRatio: fontSize > 0 ? lineHeightPx / fontSize : 0,
      letterSpacingEm: fontSize > 0 ? letterSpacingPx / fontSize : 0,
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
      creativeWorkName,
      officialLine,
      articleLabelledBy: article?.getAttribute("aria-labelledby") ?? null,
    };
  });
}

test.describe("H1 de fichas /trabajo — títulos cortos v34", () => {
  for (const width of VIEWPORTS) {
    for (const item of CASES) {
      test(`/trabajo/${item.slug} a ${width}px: texto corto, tipografía v34, sin desborde`, async ({
        page,
      }) => {
        const report = await measureH1(page, item.slug, width);
        expect(report.h1Count, `h1 count=${report.h1Count}`).toBe(1);
        expect(report.text.toLocaleUpperCase("es-AR")).toBe(item.h1);
        expect(
          report.midWordBreaks,
          `palabras partidas: ${JSON.stringify(report.midWordBreaks)}`,
        ).toEqual([]);
        expect(
          report.overflowWrap,
          "overflow-wrap anywhere/break-word permitiría partir palabras",
        ).toBe("normal");
        expect(report.fontWeight).toBe("700");
        expect(
          report.lineHeightRatio,
          `line-height ratio=${report.lineHeightRatio}; se exige ${LINE_HEIGHT}`,
        ).toBeGreaterThanOrEqual(LINE_HEIGHT - STYLE_TOLERANCE);
        expect(
          report.lineHeightRatio,
          `line-height ratio=${report.lineHeightRatio}; se exige ${LINE_HEIGHT}`,
        ).toBeLessThanOrEqual(LINE_HEIGHT + STYLE_TOLERANCE);
        expect(
          report.letterSpacingEm,
          `letter-spacing em=${report.letterSpacingEm}; se exige ${LETTER_SPACING_EM}`,
        ).toBeGreaterThanOrEqual(LETTER_SPACING_EM - STYLE_TOLERANCE);
        expect(
          report.letterSpacingEm,
          `letter-spacing em=${report.letterSpacingEm}; se exige ${LETTER_SPACING_EM}`,
        ).toBeLessThanOrEqual(LETTER_SPACING_EM + STYLE_TOLERANCE);
        expect(report.creativeWorkName).toBe(item.officialName);
        if (item.officialLine === null) {
          expect(report.officialLine).toBeNull();
          expect(report.articleLabelledBy).toBe("work-case-title");
        } else {
          expect(report.officialLine).not.toBeNull();
          expect(report.officialLine?.count).toBe(1);
          expect(report.officialLine?.nextToH1).toBe(true);
          expect(report.officialLine?.visible).toBe(true);
          expect(report.officialLine?.srOnly).toBe(false);
          expect(report.officialLine?.text).toBe(item.officialLine);
          expect(report.officialLine?.clientId).toBe("work-case-client");
          expect(report.officialLine?.inAside).toBe(true);
          expect(report.officialLine?.overflow ?? 1).toBeLessThanOrEqual(
            OVERFLOW_TOLERANCE,
          );
          expect(report.officialLine?.asideOverflow ?? 1).toBeLessThanOrEqual(
            OVERFLOW_TOLERANCE,
          );
          expect(report.articleLabelledBy).toBe(
            "work-case-title work-case-client",
          );
          const nameFont =
            width < 1024
              ? NAME_LINE_FONT_MOBILE_PX
              : NAME_LINE_FONT_DESKTOP_PX;
          expect(
            report.officialLine?.fontSize,
            `name font=${report.officialLine?.fontSize}; se exige ${nameFont}`,
          ).toBeGreaterThanOrEqual(nameFont - FONT_TOLERANCE);
          expect(
            report.officialLine?.fontSize,
            `name font=${report.officialLine?.fontSize}; se exige ${nameFont}`,
          ).toBeLessThanOrEqual(nameFont + FONT_TOLERANCE);
          expect(report.officialLine?.fontWeight).toBe(NAME_LINE_WEIGHT);
          expect(
            report.officialLine?.lineHeightRatio,
            `name LH ratio=${report.officialLine?.lineHeightRatio}`,
          ).toBeGreaterThanOrEqual(
            NAME_LINE_LINE_HEIGHT - STYLE_TOLERANCE,
          );
          expect(
            report.officialLine?.lineHeightRatio,
            `name LH ratio=${report.officialLine?.lineHeightRatio}`,
          ).toBeLessThanOrEqual(NAME_LINE_LINE_HEIGHT + STYLE_TOLERANCE);
          expect(
            report.officialLine?.lineHeightPx,
            `name LH px=${report.officialLine?.lineHeightPx}`,
          ).toBeGreaterThanOrEqual(
            nameFont * NAME_LINE_LINE_HEIGHT - FONT_TOLERANCE,
          );
          expect(
            report.officialLine?.lineHeightPx,
            `name LH px=${report.officialLine?.lineHeightPx}`,
          ).toBeLessThanOrEqual(
            nameFont * NAME_LINE_LINE_HEIGHT + FONT_TOLERANCE,
          );
          expect(
            report.officialLine?.letterSpacingEm,
            `name tracking=${report.officialLine?.letterSpacingEm}`,
          ).toBeGreaterThanOrEqual(
            NAME_LINE_LETTER_SPACING_EM - STYLE_TOLERANCE,
          );
          expect(
            report.officialLine?.letterSpacingEm,
            `name tracking=${report.officialLine?.letterSpacingEm}`,
          ).toBeLessThanOrEqual(
            NAME_LINE_LETTER_SPACING_EM + STYLE_TOLERANCE,
          );
          expect(report.officialLine?.textTransform).toBe("none");
          expect(report.officialLine?.color).toBe(
            report.officialLine?.mutedColor,
          );
          expect(
            report.officialLine?.marginTopPx,
            `name margin-top=${report.officialLine?.marginTopPx}`,
          ).toBeCloseTo(NAME_LINE_MARGIN_TOP_PX, 0);
        }

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

test.describe("línea oficial work-case__name — color muted claro/oscuro", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`afectiva a 390px color = --neutro-text-muted (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((value: string) => {
        localStorage.setItem("neutro-theme", value);
      }, theme);
      const report = await measureH1(page, "afectiva", 390);
      expect(report.officialLine).not.toBeNull();
      expect(report.officialLine?.color).toBe(report.officialLine?.mutedColor);
      expect(report.officialLine?.fontSize).toBeCloseTo(
        NAME_LINE_FONT_MOBILE_PX,
        0,
      );
      expect(report.officialLine?.fontWeight).toBe(NAME_LINE_WEIGHT);
      expect(report.officialLine?.textTransform).toBe("none");
      expect(report.officialLine?.marginTopPx).toBeCloseTo(
        NAME_LINE_MARGIN_TOP_PX,
        0,
      );
      const dark = await page
        .locator("html")
        .evaluate((el) => el.classList.contains("dark"));
      expect(dark).toBe(theme === "dark");
    });
  }
});
