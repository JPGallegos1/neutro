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
  });
}

async function gridRowGap(page: Page): Promise<string> {
  return page.evaluate(() => {
    const grid = document.querySelector(".work-index__grid");
    if (!grid) throw new Error("falta .work-index__grid");
    return getComputedStyle(grid).rowGap;
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
    const after = getComputedStyle(el, "::after");
    const boxShadow = after.boxShadow;
    const hasInsetRing =
      boxShadow !== "none" && /\binset\b/i.test(boxShadow);
    const rect = el.getBoundingClientRect();
    const ring = {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
    return {
      outlineStyle: style.outlineStyle,
      afterContent: after.content,
      afterBoxShadow: boxShadow,
      hasInsetRing,
      afterZIndex: after.zIndex,
      ring,
      inViewportX:
        ring.left >= -0.5 && ring.right <= window.innerWidth + 0.5,
      matchesFocusVisible: el.matches(":focus-visible"),
      position: style.position,
      zIndex: style.zIndex,
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
      if (width === 1023) {
        const rowGap = await gridRowGap(page);
        expect(rowGap, `row-gap computado a 1023=${rowGap}`).toBe("24px");
      }
    });
  }

  test("a 1024px: 2 columnas y row-gap 0 (el gap de 24 no aplica)", async ({
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
    const rowGap = await gridRowGap(page);
    expect(rowGap, `row-gap a 1024 debe ser 0px; quedó ${rowGap}`).toBe("0px");
    const gaps = await verticalGaps(page);
    for (const gap of gaps) {
      expect(
        gap,
        `no debería haber gap vertical de columna a 1024; gap=${gap}`,
      ).toBeLessThan(MIN_GAP_PX - RING_TOLERANCE);
    }
  });
});

test.describe("anillo de foco completo en work-card", () => {
  for (const width of DESKTOP_FOCUS) {
    test(`anillo inset visible alrededor de la card a ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/trabajo", { waitUntil: "domcontentloaded" });
      const link = page.locator("a.work-card__inner").first();
      await tabHastaCard(page, link);
      const report = await focusRingReport(link);
      expect(report, JSON.stringify(report)).not.toHaveProperty("error");
      expect(report.matchesFocusVisible).toBe(true);
      expect(report.outlineStyle).toBe("none");
      expect(
        report.hasInsetRing,
        `falta box-shadow inset en ::after: ${report.afterBoxShadow}`,
      ).toBe(true);
      expect(report.afterContent).toBe('""');
      expect(report.clippedBy).toBeUndefined();
      expect(report.inViewportX).toBe(true);
      expect(report.ring?.left ?? -1).toBeGreaterThanOrEqual(-RING_TOLERANCE);
      expect(report.ring?.right ?? width + 10).toBeLessThanOrEqual(
        width + RING_TOLERANCE,
      );
      expect(report.position, "la card enfocada necesita position relative").toBe(
        "relative",
      );
      expect(
        report.zIndex,
        "la card enfocada necesita z-index efectivo 1",
      ).toBe("1");
      expect(report.afterZIndex, "::after necesita z-index 2").toBe("2");
    });
  }
});
