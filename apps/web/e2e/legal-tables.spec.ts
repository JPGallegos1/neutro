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
  brokenWords: { word: string; natural: number; cell: number }[];
  emailHalves: {
    text: string;
    href: string;
    local: string;
    domain: string;
    localW: number;
    domainW: number;
    cellW: number;
    localFits: boolean;
    domainFits: boolean;
  }[];
};

async function tableMetrics(
  page: Page,
  path: string,
  width: number,
): Promise<TableMetric[]> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    function measureTextWidth(text: string, source: Element): number {
      const probe = document.createElement("span");
      const cs = getComputedStyle(source);
      probe.style.cssText = [
        "position:absolute",
        "visibility:hidden",
        "white-space:nowrap",
        `font:${cs.font}`,
        `letter-spacing:${cs.letterSpacing}`,
        `text-transform:${cs.textTransform}`,
      ].join(";");
      probe.textContent = text;
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    }

    function brokenWordsIn(el: Element, cellWidth: number) {
      const out: { word: string; natural: number; cell: number }[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent ?? "";
        for (const match of text.matchAll(/[^\s-]+/g)) {
          const word = match[0];
          if (word.length < 2) continue;
          const start = match.index ?? 0;
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + word.length);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0.5);
          const tops = new Set(rects.map((r) => Math.round(r.top)));
          if (tops.size < 2) continue;
          const natural = measureTextWidth(word, el);
          out.push({
            word,
            natural: Math.round(natural),
            cell: Math.round(cellWidth),
          });
        }
        node = walker.nextNode();
      }
      return out;
    }

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
          brokenWords: [] as {
            word: string;
            natural: number;
            cell: number;
          }[],
          emailHalves: [] as {
            text: string;
            href: string;
            local: string;
            domain: string;
            localW: number;
            domainW: number;
            cellW: number;
            localFits: boolean;
            domainFits: boolean;
          }[],
        };
      }
      const sampleTd = table.querySelector("td");
      const headerCells = [...table.querySelectorAll("thead th")];
      const firstRowCells = [
        ...table.querySelectorAll("tbody tr:first-child td"),
      ];
      const cols = headerCells.map((th, i) => {
        const cell = firstRowCells[i];
        return {
          header: th.textContent?.trim() ?? "",
          width: cell ? Math.round(cell.getBoundingClientRect().width) : 0,
        };
      });
      const brokenWords = [...table.querySelectorAll("th, td")].flatMap(
        (cell) => {
          const style = getComputedStyle(cell);
          const pad =
            parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
          const cellWidth = cell.getBoundingClientRect().width - pad;
          return brokenWordsIn(cell, cellWidth);
        },
      );
      const emailHalves = [
        ...table.querySelectorAll('td a[href^="mailto:"]'),
      ].map((a) => {
        const text = a.textContent?.replace(/\s+/g, "") ?? "";
        const href = a.getAttribute("href") ?? "";
        const at = text.indexOf("@");
        const local = at >= 0 ? text.slice(0, at + 1) : text;
        const domain = at >= 0 ? text.slice(at + 1) : "";
        const cell = a.closest("td") ?? a;
        const style = getComputedStyle(cell);
        const pad =
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const cellW = cell.getBoundingClientRect().width - pad;
        const localW = measureTextWidth(local, a);
        const domainW = measureTextWidth(domain, a);
        return {
          text,
          href,
          local,
          domain,
          localW: Math.round(localW),
          domainW: Math.round(domainW),
          cellW: Math.round(cellW),
          localFits: localW <= cellW + 0.5,
          domainFits: domainW <= cellW + 0.5,
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
            const tops = new Set(
              [...range.getClientRects()]
                .filter((r) => r.width > 1)
                .map((r) => Math.round(r.top)),
            );
            return {
              text: (a.textContent ?? "").replace(/\s+/g, ""),
              lines: tops.size,
            };
          },
        ),
        brokenWords,
        emailHalves,
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

  for (const width of [360, 390] as const) {
    for (const path of ["/privacidad", "/cookies"] as const) {
      test(`${path} tablas sin clase a ${width}px sin palabras partidas`, async ({
        page,
      }) => {
        const metrics = await tableMetrics(page, path, width);
        const plain = metrics.filter(
          (m) =>
            !m.cls.includes("legal-table--denunciar") &&
            !m.cls.includes("legal-table--proveedores"),
        );
        expect(plain.length).toBeGreaterThan(0);
        for (const row of plain) {
          expect(row.pageScroll).toBe(0);
          expect(row.wrapOverflow).toBeLessThanOrEqual(1);
          expect(
            row.brokenWords,
            `${path} a ${width}: palabras partidas ${JSON.stringify(row.brokenWords)}`,
          ).toEqual([]);
          expect(row.overflowWrap).toBe("normal");
        }
      });
    }
  }

  for (const width of [320, 340] as const) {
    for (const path of [
      "/privacidad",
      "/cookies",
      "/alerta-estafa",
    ] as const) {
      test(`${path} a ${width}px sin desborde de página`, async ({ page }) => {
        const metrics = await tableMetrics(page, path, width);
        expect(metrics.length).toBeGreaterThan(0);
        for (const row of metrics) {
          expect(row.pageScroll).toBe(0);
        }
      });
    }
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
    const tableWidth = proveedores.cols.reduce((sum, col) => sum + col.width, 0);
    expect(tableWidth, "ancho total de columnas").toBeGreaterThan(0);
    const paraRatio = paraQue.width / tableWidth;
    expect(
      paraRatio,
      `Para qué es ${(paraRatio * 100).toFixed(1)}% del ancho; esperado ~56% (50–62)`,
    ).toBeGreaterThanOrEqual(0.5);
    expect(
      paraRatio,
      `Para qué es ${(paraRatio * 100).toFixed(1)}% del ancho; esperado ~56% (50–62)`,
    ).toBeLessThanOrEqual(0.62);
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

  for (const width of [320, 360, 390] as const) {
    test(`/alerta-estafa emails: mitades tras @ caben a ${width}px`, async ({
      page,
    }) => {
      const metrics = await tableMetrics(page, "/alerta-estafa", width);
      const denunciar = metrics.find((m) =>
        m.cls.includes("legal-table--denunciar"),
      );
      expect(denunciar, "falta la tabla denunciar").toBeTruthy();
      if (!denunciar) return;
      expect(denunciar.emailHalves.length).toBe(3);
      for (const mail of denunciar.emailHalves) {
        expect(mail.href.startsWith("mailto:")).toBe(true);
        expect(mail.href.slice("mailto:".length)).toBe(mail.text);
        expect(mail.text.includes("\u200B")).toBe(false);
        if (width >= 360) {
          expect(
            mail.localFits,
            `${mail.local} (${mail.localW}px) no entra en ${mail.cellW}px`,
          ).toBe(true);
          expect(
            mail.domainFits,
            `${mail.domain} (${mail.domainW}px) no entra en ${mail.cellW}px`,
          ).toBe(true);
        }
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
