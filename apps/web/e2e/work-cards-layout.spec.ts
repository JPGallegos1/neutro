import { expect, test, type Locator, type Page } from "@playwright/test";

const GAP_VIEWPORTS = [360, 390, 768, 1023] as const;
const DESKTOP_FOCUS = [1024, 1440] as const;
const MIN_GAP_PX = 24;
const MIN_RING_PX = 2;
const RING_TOLERANCE = 0.5;
const MAX_TABS = 40;

const GAP_SURFACES = [
  {
    name: "/trabajo",
    path: "/trabajo",
    grid: ".work-index__grid",
    cardScope: ".work-index__grid",
  },
  {
    name: "home",
    path: "/",
    grid: ".work__grid",
    cardScope: ".work__grid",
  },
  {
    name: "Más trabajo",
    path: "/trabajo/conexion-laboral",
    grid: ".work-case__related-grid",
    cardScope: ".work-case__related-grid",
  },
] as const;

function parseInsetShadows(boxShadow: string): Array<{
  spreadPx: number;
  color: string;
}> {
  if (!boxShadow || boxShadow === "none") return [];
  const parts = boxShadow.split(/,(?![^(]*\))/);
  const colorRe =
    /rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|\b[a-zA-Z]+\b/;
  const inset: Array<{ spreadPx: number; color: string }> = [];
  for (const part of parts) {
    if (!/\binset\b/i.test(part)) continue;
    const withoutInset = part.replace(/\binset\b/gi, " ").trim();
    const colorMatch = withoutInset.match(colorRe);
    const nums = [...withoutInset.matchAll(/-?\d+(?:\.\d+)?px/gi)].map((m) =>
      Number.parseFloat(m[0]),
    );
    if (nums.length < 4) continue;
    const spreadPx = Math.abs(nums[3] ?? 0);
    const color = (colorMatch?.[0] ?? "").trim();
    if (/^(inset|px)$/i.test(color)) continue;
    inset.push({ spreadPx, color });
  }
  return inset;
}

function isTransparentColor(color: string): boolean {
  const c = color.trim().toLowerCase();
  if (!c || c === "transparent") return true;
  const rgba = c.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (rgba) {
    const alpha = rgba[4] === undefined ? 1 : Number.parseFloat(rgba[4]);
    return alpha === 0;
  }
  return false;
}

function normalizeColor(color: string): string {
  return color.replace(/\s+/g, "").toLowerCase();
}

function colorsEqual(a: string, b: string): boolean {
  return normalizeColor(a) === normalizeColor(b);
}

async function verticalGaps(page: Page, cardScope: string): Promise<number[]> {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope);
    if (!root) throw new Error(`falta ${scope}`);
    const cards = [...root.querySelectorAll(":scope > li.work-card")].filter(
      (card) => getComputedStyle(card).display !== "none",
    );
    const gaps: number[] = [];
    for (let i = 0; i < cards.length - 1; i += 1) {
      const current = cards[i];
      const next = cards[i + 1];
      if (!current || !next) {
        throw new Error(
          `faltan cards adyacentes en el índice ${i} (visibles: ${cards.length})`,
        );
      }
      const a = current.getBoundingClientRect();
      const b = next.getBoundingClientRect();
      if (Math.abs(a.left - b.left) < 40) {
        gaps.push(b.top - a.bottom);
      }
    }
    return gaps;
  }, cardScope);
}

async function gridRowGap(page: Page, gridSelector: string): Promise<string> {
  return page.evaluate((selector) => {
    const grid = document.querySelector(selector);
    if (!grid) throw new Error(`falta ${selector}`);
    return getComputedStyle(grid).rowGap;
  }, gridSelector);
}

async function gridColumnCount(
  page: Page,
  gridSelector: string,
): Promise<number> {
  return page.evaluate((selector) => {
    const grid = document.querySelector(selector);
    if (!grid) return 0;
    return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  }, gridSelector);
}

async function tabHastaCard(page: Page, link: Locator): Promise<void> {
  let llego = false;
  for (let paso = 0; paso < MAX_TABS; paso += 1) {
    await page.keyboard.press("Tab");
    llego = await link.evaluate((el) => document.activeElement === el);
    if (llego) break;
  }
  expect(llego, "Tab no llegó a la primera work-card").toBe(true);
  await expect(link).toBeFocused();
}

async function focusRingReport(link: Locator) {
  return link.evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      return { error: "el enlace no es HTMLElement" };
    }
    if (document.activeElement !== el) {
      return { error: "el elemento activo no es la card" };
    }
    const style = getComputedStyle(el);
    const after = getComputedStyle(el, "::after");
    const boxShadow = after.boxShadow;
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;background-color:var(--neutro-bg)";
    document.body.appendChild(probe);
    const neutroBg = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const rect = el.getBoundingClientRect();
    const ring = {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      afterContent: after.content,
      afterBoxShadow: boxShadow,
      afterOutlineStyle: after.outlineStyle,
      afterOutlineWidth: after.outlineWidth,
      afterOutlineColor: after.outlineColor,
      afterZIndex: after.zIndex,
      neutroBg,
      ring,
      inViewportX:
        ring.left >= -0.5 && ring.right <= window.innerWidth + 0.5,
      matchesFocusVisible: el.matches(":focus-visible"),
      position: style.position,
      zIndex: style.zIndex,
    };
  });
}

async function expandTrabajoGrid(page: Page): Promise<void> {
  const loadMore = page.locator("[data-work-more] button, .work-index__load");
  if (await loadMore.isVisible().catch(() => false)) {
    await loadMore.click();
  }
}

async function tabHastaNthCard(
  page: Page,
  links: Locator,
  index: number,
): Promise<Locator> {
  const link = links.nth(index);
  let llego = false;
  for (let paso = 0; paso < MAX_TABS + index * 5; paso += 1) {
    await page.keyboard.press("Tab");
    llego = await link.evaluate((el) => document.activeElement === el);
    if (llego) break;
  }
  expect(llego, `Tab no llegó a la work-card #${index}`).toBe(true);
  await expect(link).toBeFocused();
  return link;
}

function assertInsetRing(
  report: Awaited<ReturnType<typeof focusRingReport>> & {
    neutroBg?: string;
  },
): void {
  expect(report, JSON.stringify(report)).not.toHaveProperty("error");
  const shadows = parseInsetShadows(String(report.afterBoxShadow ?? "none"));
  const opaque = shadows.filter((s) => !isTransparentColor(s.color));
  expect(
    opaque.length,
    `anillo inset necesita ≥2 sombras opacas (banda fondo + color); hay ${opaque.length}: ${report.afterBoxShadow}`,
  ).toBeGreaterThanOrEqual(2);
  const maxSpread = Math.max(...opaque.map((s) => s.spreadPx));
  expect(
    maxSpread,
    `anillo inset demasiado fino (${maxSpread}px); mínimo ${MIN_RING_PX}px: ${report.afterBoxShadow}`,
  ).toBeGreaterThanOrEqual(MIN_RING_PX);
  const distinct = new Set(opaque.map((s) => normalizeColor(s.color)));
  expect(
    distinct.size,
    `anillo inset sin dos colores distintos (banda vs foco): ${report.afterBoxShadow}`,
  ).toBeGreaterThanOrEqual(2);
  const neutroBg = String(report.neutroBg ?? "").trim();
  if (neutroBg) {
    const nonBg = opaque.filter((s) => !colorsEqual(s.color, neutroBg));
    expect(
      nonBg.length,
      `falta banda de color distinta de --neutro-bg (${neutroBg}): ${report.afterBoxShadow}`,
    ).toBeGreaterThan(0);
    expect(
      Math.max(...nonBg.map((s) => s.spreadPx)),
      `banda de color < ${MIN_RING_PX}px: ${report.afterBoxShadow}`,
    ).toBeGreaterThanOrEqual(MIN_RING_PX);
  }
}

function assertForcedColorsIndicator(
  report: Awaited<ReturnType<typeof focusRingReport>>,
): void {
  expect(report, JSON.stringify(report)).not.toHaveProperty("error");
  const style = String(report.afterOutlineStyle ?? "");
  const width = Number.parseFloat(String(report.afterOutlineWidth ?? "0"));
  const color = String(report.afterOutlineColor ?? "");
  const outlineOk =
    style !== "none" &&
    Number.isFinite(width) &&
    width >= MIN_RING_PX &&
    !isTransparentColor(color);
  expect(
    outlineOk,
    `forced-colors sin indicador visible en ::after (style=${style}, width=${report.afterOutlineWidth}, color=${color}, boxShadow=${report.afterBoxShadow})`,
  ).toBe(true);
}

test.describe("separación vertical de work-cards en una columna", () => {
  for (const surface of GAP_SURFACES) {
    for (const width of GAP_VIEWPORTS) {
      test(`row-gap ≥ ${MIN_GAP_PX}px en ${surface.name} a ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(surface.path, { waitUntil: "domcontentloaded" });
        const gaps = await verticalGaps(page, surface.cardScope);
        expect(
          gaps.length,
          `se esperaban gaps entre cards apiladas en ${surface.name}`,
        ).toBeGreaterThan(0);
        for (const gap of gaps) {
          expect(
            gap,
            `gap=${gap} en ${surface.name} a ${width}px`,
          ).toBeGreaterThanOrEqual(MIN_GAP_PX - RING_TOLERANCE);
        }
        if (width === 1023) {
          const rowGap = await gridRowGap(page, surface.grid);
          expect(
            rowGap,
            `row-gap computado en ${surface.name} a 1023=${rowGap}`,
          ).toBe("24px");
        }
      });
    }

    test(`a 1024px en ${surface.name}: 2 columnas y row-gap 0`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });
      const cols = await gridColumnCount(page, surface.grid);
      expect(cols, `columnas en ${surface.name}`).toBe(2);
      const rowGap = await gridRowGap(page, surface.grid);
      expect(
        rowGap,
        `row-gap a 1024 en ${surface.name} debe ser 0px; quedó ${rowGap}`,
      ).toBe("0px");
      const gaps = await verticalGaps(page, surface.cardScope);
      for (const gap of gaps) {
        expect(
          gap,
          `no debería haber gap vertical de columna en ${surface.name} a 1024; gap=${gap}`,
        ).toBeLessThan(MIN_GAP_PX - RING_TOLERANCE);
      }
    });
  }
});

test.describe("anillo de foco completo en work-card", () => {
  for (const width of DESKTOP_FOCUS) {
    test(`anillo inset 2 bandas en todas las cards a ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
      await expandTrabajoGrid(page);
      const links = page.locator(".work-index__grid a.work-card__inner");
      const count = await links.count();
      expect(count, "se esperaban cards en /trabajo").toBeGreaterThanOrEqual(3);
      const indices = [
        0,
        Math.floor((count - 1) / 2),
        count - 1,
      ].filter((v, i, arr) => arr.indexOf(v) === i);
      for (const index of indices) {
        const link = await tabHastaNthCard(page, links, index);
        const report = await focusRingReport(link);
        expect(
          report.matchesFocusVisible,
          `card #${index} sin :focus-visible`,
        ).toBe(true);
        expect(report.outlineStyle).toBe("none");
        assertInsetRing(report);
        expect(report.afterContent).toBe('""');
        expect(report.inViewportX).toBe(true);
        expect(report.ring?.left ?? -1).toBeGreaterThanOrEqual(-RING_TOLERANCE);
        expect(report.ring?.right ?? width + 10).toBeLessThanOrEqual(
          width + RING_TOLERANCE,
        );
        expect(
          report.position,
          `card #${index}: necesita position relative`,
        ).toBe("relative");
        expect(
          report.zIndex,
          `card #${index}: necesita z-index efectivo 1`,
        ).toBe("1");
        expect(report.afterZIndex, `card #${index}: ::after z-index 2`).toBe(
          "2",
        );
      }
    });
  }

  test("forced-colors: indicador visible vía outline en ::after", async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
    const link = page.locator("a.work-card__inner").first();
    await tabHastaCard(page, link);
    const report = await focusRingReport(link);
    expect(report.matchesFocusVisible).toBe(true);
    assertForcedColorsIndicator(report);
  });
});
