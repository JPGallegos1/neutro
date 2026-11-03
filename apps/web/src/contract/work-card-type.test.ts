import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const landingCss = readFileSync(join(webRoot, "styles/landing.css"), "utf8");
const workCardSource = readFileSync(
  join(webRoot, "components/sections/WorkCard.astro"),
  "utf8",
);
const servicesSource = readFileSync(
  join(webRoot, "components/sections/ServicesAccordion.astro"),
  "utf8",
);

function pageCss(relativePath: string): string {
  const html = readFileSync(join(distDir, relativePath), "utf8");
  const blocks: string[] = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push(match[1] ?? "");
  }
  return blocks.join("\n");
}

function assertSharedTitleTokens(css: string, where: string): void {
  assert.match(
    css,
    /--landing-service-title-size\s*:\s*28px/,
    `${where}: falta --landing-service-title-size 28px`,
  );
  assert.match(
    css,
    /--landing-service-title-weight\s*:\s*200/,
    `${where}: falta --landing-service-title-weight 200`,
  );
  assert.match(
    css,
    /--landing-service-title-leading\s*:\s*normal/,
    `${where}: falta --landing-service-title-leading normal`,
  );
  assert.match(
    css,
    /--landing-service-summary-size\s*:\s*18px/,
    `${where}: falta --landing-service-summary-size 18px`,
  );
  assert.match(
    css,
    /--landing-service-summary-leading\s*:\s*1\.3/,
    `${where}: falta --landing-service-summary-leading 1.3`,
  );
  assert.match(
    css,
    /\.landing-service-title\s*\{[^}]*font-size\s*:\s*var\(--landing-service-title-size\)/,
    `${where}: .landing-service-title debe usar el token de size`,
  );
  assert.match(
    css,
    /\.landing-service-summary\s*\{[^}]*font-size\s*:\s*var\(--landing-service-summary-size\)/,
    `${where}: .landing-service-summary debe usar el token de size`,
  );
  assert.match(
    css,
    /\.landing-service-summary\s*\{[^}]*line-height\s*:\s*var\(--landing-service-summary-leading\)/,
    `${where}: .landing-service-summary debe usar el token de leading`,
  );
}

describe("tipografía compartida Qué hacemos ↔ work-card", () => {
  it("define tokens y clases compartidas en landing.css", () => {
    assertSharedTitleTokens(landingCss, "landing.css");
    assert.match(
      landingCss,
      /@media\s*\(min-width:\s*1024px\)\s*\{[^}]*--landing-service-title-size\s*:\s*48px/s,
    );
    assert.match(
      landingCss,
      /@media\s*\(min-width:\s*1024px\)\s*\{[^}]*--landing-service-summary-size\s*:\s*24px/s,
    );
  });

  it("aplica las clases compartidas en markup de servicios y work-card", () => {
    assert.match(
      servicesSource,
      /class="accordion-item__trigger landing-service-title"/,
    );
    assert.match(
      servicesSource,
      /class="accordion-item__summary landing-service-summary"/,
    );
    assert.match(
      workCardSource,
      /class="work-card__title landing-service-title"/,
    );
    assert.match(
      workCardSource,
      /class="work-card__desc landing-service-summary"/,
    );
    assert.doesNotMatch(
      workCardSource,
      /\.work-card__title\s*\{[^}]*font-size\s*:/,
    );
    assert.doesNotMatch(
      workCardSource,
      /\.work-card__desc\s*\{[^}]*font-size\s*:/,
    );
    assert.doesNotMatch(
      servicesSource,
      /\.accordion-item__trigger\s*\{[^}]*font-size\s*:/,
    );
    assert.doesNotMatch(
      servicesSource,
      /\.accordion-item__summary\s*\{[^}]*font-size\s*:/,
    );
  });

  it("expone las clases tipográficas en el dist de home y /trabajo", () => {
    const bundled = readFileSync(join(distDir, "index.html"), "utf8");
    const hrefs = [
      ...bundled.matchAll(
        /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi,
      ),
    ].map((match) => match[1] ?? "");
    assert.ok(hrefs.length > 0, "dist/index.html sin stylesheets");
    const sheetCss = hrefs
      .map((href) => {
        const path = href.startsWith("/")
          ? join(distDir, href.slice(1))
          : join(distDir, href);
        return readFileSync(path, "utf8");
      })
      .join("\n");
    assertSharedTitleTokens(sheetCss, "dist stylesheets");
    assert.match(
      pageCss("index.html"),
      /\.work-card__details(?:\[data-astro-cid-[^\]]+\])?\s*\{[^}]*padding-inline\s*:\s*var\(--landing-gutter\)/,
    );
    for (const page of ["index.html", "trabajo.html"]) {
      const html = readFileSync(join(distDir, page), "utf8");
      assert.match(html, /work-card__title[^"]*landing-service-title/);
      assert.match(html, /work-card__desc[^"]*landing-service-summary/);
    }
    assert.match(bundled, /accordion-item__trigger[^"]*landing-service-title/);
    assert.match(
      bundled,
      /accordion-item__summary[^"]*landing-service-summary/,
    );
  });

  it("falla si work-card pierde la clase tipográfica compartida", () => {
    const mutated = workCardSource.replaceAll(
      "landing-service-title",
      "work-card__title-only",
    );
    assert.throws(() => {
      assert.match(mutated, /class="work-card__title landing-service-title"/);
    }, /landing-service-title/);
  });
});

describe("row-gap de grids de trabajo", () => {
  it("usa el token --landing-work-row-gap en grids y en landing.css", () => {
    assert.match(landingCss, /--landing-work-row-gap\s*:\s*24px/);
    assert.match(
      landingCss,
      /@media\s*\(min-width:\s*1024px\)\s*\{[^}]*--landing-work-row-gap\s*:\s*48px/s,
    );
    for (const relative of [
      "components/sections/WorkSection.astro",
      "components/sections/WorkIndex.astro",
      "components/sections/WorkCasePage.astro",
    ]) {
      const source = readFileSync(join(webRoot, relative), "utf8");
      assert.match(
        source,
        /row-gap:\s*var\(--landing-work-row-gap\)/,
        `${relative} debe usar var(--landing-work-row-gap)`,
      );
      assert.doesNotMatch(
        source,
        /row-gap:\s*0\b/,
        `${relative} no debe forzar row-gap 0`,
      );
    }
  });

  it("falla si el token de row-gap desktop deja de ser 48px", () => {
    const mutated = landingCss.replace(
      /(--landing-work-row-gap\s*:\s*)48px/,
      "$10px",
    );
    assert.throws(() => {
      assert.match(
        mutated,
        /@media\s*\(min-width:\s*1024px\)\s*\{[^}]*--landing-work-row-gap\s*:\s*48px/s,
      );
    }, /48px/);
  });
});
