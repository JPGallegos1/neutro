import { expect, test, type Page } from "@playwright/test";

type TableMetric = {
  cls: string;
  wrapOverflow: number;
  pageScroll: number;
  overflowWrap: string;
  tableLayout: string;
  height: number;
  cols: { header: string; width: number }[];
  emailLines: { text: string; lines: number }[];
};

async function tableMetrics(
  page: Page,
  path: string,
  width: number,
): Promise<TableMetric[]> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    return [...document.querySelectorAll(".legal-table-wrap")].map((wrap) => {
      const table = wrap.querySelector("table");
      if (!table) {
        return {
          cls: "",
          wrapOverflow: 0,
          pageScroll: 0,
          overflowWrap: "",
          tableLayout: "",
          height: 0,
          cols: [] as { header: string; width: number }[],
          emailLines: [] as { text: string; lines: number }[],
        };
      }
      const sampleTd = table.querySelector("td");
      const headerCells = [...table.querySelectorAll("thead th")];
      const firstRowCells = [...table.querySelectorAll("tbody tr:first-child td")];
      const cols = headerCells.map((th, i) => {
        const cell = firstRowCells[i];
        return {
          header: th.textContent?.trim() ?? "",
          width: cell ? Math.round(cell.getBoundingClientRect().width) : 0,
        };
      });
      return {
        cls: table.className,
        wrapOverflow: table.scrollWidth - wrap.clientWidth,
        pageScroll: document.documentElement.scrollWidth - window.innerWidth,
        overflowWrap: sampleTd ? getComputedStyle(sampleTd).overflowWrap : "",
        tableLayout: getComputedStyle(table).tableLayout,
        height: Math.round(table.getBoundingClientRect().height),
        cols,
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
        expect(row.cls).toContain("legal-table--denunciar");
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

  test("/privacidad proveedores a 360: Para qué usable y mail sin 3 líneas", async ({
    page,
  }) => {
    const metrics = await tableMetrics(page, "/privacidad", 360);
    const proveedores = metrics.find((m) =>
      m.cls.includes("legal-table--proveedores"),
    );
    expect(proveedores, "falta la tabla de proveedores").toBeTruthy();
    if (!proveedores) return;
    expect(proveedores.pageScroll).toBe(0);
    expect(proveedores.wrapOverflow).toBeLessThanOrEqual(1);
    const paraQue = proveedores.cols.find((c) => c.header === "Para qué");
    expect(paraQue, "falta columna Para qué").toBeTruthy();
    if (!paraQue) return;
    expect(
      paraQue.width,
      `Para qué quedó en ${paraQue.width}px; hace falta ≥120`,
    ).toBeGreaterThanOrEqual(120);
    const hola = proveedores.emailLines.find((e) =>
      e.text.includes("hola@neutro.solutions"),
    );
    expect(hola, "falta mailto hola@neutro.solutions").toBeTruthy();
    if (!hola) return;
    expect(
      hola.lines,
      `${hola.text} se partió en ${hola.lines} líneas`,
    ).toBeLessThan(3);
  });

  test("/alerta-estafa a 360: sin desborde y altura acotada vs main", async ({
    page,
  }) => {
    const metrics = await tableMetrics(page, "/alerta-estafa", 360);
    const denunciar = metrics.find((m) =>
      m.cls.includes("legal-table--denunciar"),
    );
    expect(denunciar, "falta la tabla denunciar").toBeTruthy();
    if (!denunciar) return;
    expect(denunciar.pageScroll).toBe(0);
    expect(denunciar.wrapOverflow).toBeLessThanOrEqual(1);
    expect(
      denunciar.height,
      `altura ${denunciar.height}px supera 2× main (1576)`,
    ).toBeLessThanOrEqual(1576);
  });
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
