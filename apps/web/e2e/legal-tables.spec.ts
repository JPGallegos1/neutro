import { expect, test, type Page } from "@playwright/test";

async function tableMetrics(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    return [...document.querySelectorAll(".legal-table-wrap")].map((wrap) => {
      const table = wrap.querySelector("table");
      if (!table) {
        return {
          wrapOverflow: 0,
          pageScroll: 0,
          overflowWrap: "",
          tableLayout: "",
          emailLines: [] as { text: string; lines: number }[],
        };
      }
      const sampleTd = table.querySelector("td");
      return {
        wrapOverflow: table.scrollWidth - wrap.clientWidth,
        pageScroll: document.documentElement.scrollWidth - window.innerWidth,
        overflowWrap: sampleTd ? getComputedStyle(sampleTd).overflowWrap : "",
        tableLayout: getComputedStyle(table).tableLayout,
        emailLines: [...table.querySelectorAll('td a[href^="mailto:"]')].map(
          (a) => {
            const range = document.createRange();
            range.selectNodeContents(a);
            return {
              text: a.textContent?.trim() ?? "",
              lines: [...range.getClientRects()].length,
            };
          },
        ),
      };
    });
  });
}

test.describe("tablas legales sin desborde en móvil", () => {
  for (const width of [360, 390] as const) {
    test(`/alerta-estafa a ${width}px sin overflow de wrap ni de página`, async ({
      page,
    }) => {
      const metrics = await tableMetrics(page, "/alerta-estafa", width);
      expect(metrics.length).toBeGreaterThan(0);
      for (const row of metrics) {
        expect(row.pageScroll).toBe(0);
        expect(row.wrapOverflow).toBeLessThanOrEqual(1);
        expect(row.overflowWrap).toBe("break-word");
        expect(row.tableLayout).toBe("fixed");
      }
    });

    test(`/privacidad a ${width}px sin overflow de wrap ni de página`, async ({
      page,
    }) => {
      const metrics = await tableMetrics(page, "/privacidad", width);
      expect(metrics.length).toBeGreaterThan(0);
      for (const row of metrics) {
        expect(row.pageScroll).toBe(0);
        expect(row.wrapOverflow).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe("tablas legales sin wrap forzado en desktop", () => {
  for (const width of [768, 1280, 1440] as const) {
    test(`/alerta-estafa a ${width}px: overflow-wrap normal`, async ({
      page,
    }) => {
      const metrics = await tableMetrics(page, "/alerta-estafa", width);
      expect(metrics.length).toBeGreaterThan(0);
      for (const row of metrics) {
        expect(row.overflowWrap).toBe("normal");
        expect(row.tableLayout).toBe("auto");
        expect(row.pageScroll).toBe(0);
        const shortMails = row.emailLines.filter((e) => e.text.length <= 28);
        for (const mail of shortMails) {
          expect(
            mail.lines,
            `${mail.text} no debería partirse a ${width}px`,
          ).toBe(1);
        }
      }
    });
  }
});
