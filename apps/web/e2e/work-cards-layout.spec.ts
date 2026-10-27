import { expect, test, type Locator, type Page } from "@playwright/test";

const GAP_VIEWPORTS = [360, 390, 768, 1023] as const;
const DESKTOP_FOCUS = [1024, 1440] as const;
const MIN_GAP_PX = 24;
const RING_TOLERANCE = 0.5;
const MAX_TABS = 40;

async function verticalGaps(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll("li.work-card")].filter(
      (card) => getComputedStyle(card).display !== "none",
    );
    const gaps: number[] = [];
    for (let i = 0; i < cards.length - 1; i += 1) {
      const a = cards[i].getBoundingClientRect();
      const b = cards[i + 1].getBoundingClientRect();
      if (Math.abs(a.left - b.left) < 40) {
        gaps.push(b.top - a.bottom);
      }
    }
    return gaps;
  });
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
    const offset = Number.parseFloat(style.outlineOffset);
    const width = Number.parseFloat(style.outlineWidth);
    const color = style.outlineColor.trim().toLowerCase();
    const transparente =
      color === "transparent" ||
      /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0(?:\.0+)?\s*\)$/.test(
        color,
      );
    const rect = el.getBoundingClientRect();
    const pad = offset + width;
    const ring = {
      left: rect.left - pad,
      right: rect.right + pad,
      top: rect.top - pad,
      bottom: rect.bottom + pad,
    };
    let clippedBy: string | null = null;
    for (
      let node: HTMLElement | null = el.parentElement;
      node;
      node = node.parentElement
    ) {
      const s = getComputedStyle(node);
      const clipsX = /hidden|clip|scroll|auto/.test(s.overflowX);
      const clipsY = /hidden|clip|scroll|auto/.test(s.overflowY);
      if (!clipsX && !clipsY) continue;
      const er = node.getBoundingClientRect();
      if (
        ring.left < er.left - 0.5 ||
        ring.right > er.right + 0.5 ||
        ring.top < er.top - 0.5 ||
        ring.bottom > er.bottom + 0.5
      ) {
        clippedBy = node.className || node.tagName;
        break;
      }
    }
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: width,
      outlineOffset: offset,
      transparente,
      ring,
      inViewportX:
        ring.left >= -0.5 && ring.right <= window.innerWidth + 0.5,
      clippedBy,
      insetRing: offset < 0,
      matchesFocusVisible: el.matches(":focus-visible"),
    };
  });
}

test.describe("separación vertical de work-cards en una columna", () => {
  for (const width of GAP_VIEWPORTS) {
    test(`row-gap ≥ ${MIN_GAP_PX}px en /trabajo a ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
      const gaps = await verticalGaps(page);
      expect(
        gaps.length,
        "se esperaban gaps entre cards apiladas",
      ).toBeGreaterThan(0);
      for (const gap of gaps) {
        expect(gap, `gap=${gap} a ${width}px`).toBeGreaterThanOrEqual(
          MIN_GAP_PX - RING_TOLERANCE,
        );
      }
    });
  }

  test("en desktop 1024px el grid es de 2 columnas sin gaps verticales entre filas distintas de la misma columna medidos como apilado", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
    const cols = await page.evaluate(() => {
      const grid = document.querySelector(".work-index__grid");
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    });
    expect(cols).toBe(2);
  });
});

test.describe("anillo de foco completo en work-card", () => {
  for (const width of DESKTOP_FOCUS) {
    test(`anillo visible alrededor de la card a ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
      const link = page.locator("a.work-card__inner").first();
      await tabHastaCard(page, link);
      const report = await focusRingReport(link);
      expect(report, JSON.stringify(report)).not.toHaveProperty("error");
      expect(report.matchesFocusVisible).toBe(true);
      expect(report.outlineStyle).not.toBe("none");
      expect(report.transparente).toBe(false);
      expect(report.outlineWidth).toBeGreaterThan(0);
      expect(report.outlineOffset).toBeGreaterThanOrEqual(0);
      expect(report.insetRing).toBe(false);
      expect(report.clippedBy).toBeNull();
      expect(report.inViewportX).toBe(true);
      expect(report.ring?.left ?? -1).toBeGreaterThanOrEqual(-RING_TOLERANCE);
      expect(report.ring?.right ?? width + 10).toBeLessThanOrEqual(
        width + RING_TOLERANCE,
      );
    });
  }
});
