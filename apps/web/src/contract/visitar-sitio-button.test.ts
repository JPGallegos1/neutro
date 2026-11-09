import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const workCaseSource = readFileSync(
  join(webRoot, "components/sections/WorkCasePage.astro"),
  "utf8",
);

function pageCss(relativePath: string): string {
  const html = readFileSync(join(distDir, relativePath), "utf8");
  const blocks: string[] = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push(match[1] ?? "");
  }
  const hrefs = [
    ...html.matchAll(
      /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi,
    ),
  ].map((match) => match[1] ?? "");
  for (const href of hrefs) {
    const path = href.startsWith("/")
      ? join(distDir, href.slice(1))
      : join(distDir, href);
    blocks.push(readFileSync(path, "utf8"));
  }
  return blocks.join("\n");
}

function visitLinkRule(css: string): string {
  const match = css.match(
    /\.work-case__visit-link(?:\[data-astro-cid-[^\]]+\])?\s*\{([^}]*)\}/,
  );
  assert.ok(match?.[1], "falta la regla .work-case__visit-link");
  return match[1];
}

function assertMonochromeVisitLink(css: string, where: string): void {
  const rule = visitLinkRule(css);
  assert.match(
    rule,
    /color\s*:\s*var\(--neutro-text\)/,
    `${where}: color debe ser var(--neutro-text)`,
  );
  assert.match(
    rule,
    /text-decoration\s*:\s*underline/,
    `${where}: text-decoration debe ser underline`,
  );
  assert.doesNotMatch(
    rule,
    /neutro-accent-blue|neutro-on-blue|neutro-accent-orange|bg-primary|#5c78ff|#2b4bff/i,
    `${where}: .work-case__visit-link no debe usar acento`,
  );
  assert.doesNotMatch(
    css,
    /\.work-case__visit-link[^\{]*\{[^}]*(?:neutro-accent-blue|neutro-on-blue|bg-primary|#5c78ff|#2b4bff)/i,
    `${where}: ninguna regla de .work-case__visit-link debe traer acento`,
  );
  assert.doesNotMatch(
    css,
    /\.work-case__visit(?![-\w])/,
    `${where}: no debe quedar estilo de botón .work-case__visit`,
  );
}

describe("Visitar sitio monocromo", () => {
  it("usa un solo link subrayado al cierre del contenido, sin botón", () => {
    assert.match(workCaseSource, /work-case__visit-end/);
    assert.match(workCaseSource, /work-case__visit-link/);
    assert.match(
      workCaseSource,
      /\.work-case__visit-link\s*\{[^}]*color:\s*var\(--neutro-text\)/s,
    );
    assert.match(
      workCaseSource,
      /\.work-case__visit-link\s*\{[^}]*text-decoration:\s*underline/s,
    );
    assert.equal(
      (workCaseSource.match(/Visitar sitio/g) ?? []).length,
      1,
      "debe haber una sola ocurrencia de Visitar sitio en el markup",
    );
    assert.doesNotMatch(workCaseSource, /work-case__visit--aside/);
    assert.doesNotMatch(
      workCaseSource,
      /\.work-case__visit(?![-\w])\s*\{/,
    );
    assert.doesNotMatch(
      workCaseSource,
      /work-case__visit[\s\S]*?(neutro-accent-blue|neutro-on-blue|bg-primary)/,
    );
    assert.doesNotMatch(workCaseSource, /work-case__tag|En producción/);
  });

  it("expone el link monocromo en dist/trabajo/conexion-laboral.html", () => {
    const css = pageCss("trabajo/conexion-laboral.html");
    assertMonochromeVisitLink(css, "dist/trabajo/conexion-laboral.html");
  });

  it("falla si vuelve el acento azul al link", () => {
    const css = pageCss("trabajo/conexion-laboral.html");
    const mutated = css.replace(
      /(\.work-case__visit-link(?:\[data-astro-cid-[^\]]+\])?\s*\{[^}]*?)color\s*:\s*var\(--neutro-text\)/i,
      "$1color: var(--neutro-accent-blue)",
    );
    assert.notEqual(mutated, css, "no se pudo inyectar el acento");
    assert.throws(
      () => assertMonochromeVisitLink(mutated, "mutación"),
      /acento|neutro-text/,
    );
    assertMonochromeVisitLink(css, "dist/trabajo/conexion-laboral.html");
  });
});
