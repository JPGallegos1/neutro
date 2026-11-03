import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const workIndexSource = readFileSync(
  join(webRoot, "components/sections/WorkIndex.astro"),
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

function loadRule(css: string): string {
  const match = css.match(
    /\.work-index__load(?![-\w])(?:\[data-astro-cid-[^\]]+\])?\s*\{([^}]*)\}/,
  );
  assert.ok(match?.[1], "falta la regla .work-index__load");
  return match[1];
}

function assertMonochromeLoadButton(css: string, where: string): void {
  const rule = loadRule(css);
  assert.match(
    rule,
    /background\s*:\s*var\(--neutro-text\)/,
    `${where}: background debe ser var(--neutro-text)`,
  );
  assert.match(
    rule,
    /color\s*:\s*var\(--neutro-bg\)/,
    `${where}: color debe ser var(--neutro-bg)`,
  );
  assert.doesNotMatch(
    rule,
    /neutro-accent-blue|neutro-on-blue|neutro-accent-orange|#5c78ff|#2b4bff/i,
    `${where}: .work-index__load no debe usar acento`,
  );
  assert.doesNotMatch(
    css,
    /\.work-index__load(?![-\w])[^\{]*\{[^}]*(?:neutro-accent-blue|neutro-on-blue|#5c78ff|#2b4bff)/i,
    `${where}: ninguna regla de .work-index__load debe traer acento`,
  );
}

describe("Cargar más monocromo", () => {
  it("usa tokens blanco/negro en el markup fuente, sin acento", () => {
    assert.match(
      workIndexSource,
      /\.work-index__load\s*\{[^}]*background:\s*var\(--neutro-text\)/s,
    );
    assert.match(
      workIndexSource,
      /\.work-index__load\s*\{[^}]*color:\s*var\(--neutro-bg\)/s,
    );
    assert.doesNotMatch(
      workIndexSource,
      /\.work-index__load[\s\S]*?(neutro-accent-blue|neutro-on-blue)/,
    );
  });

  it("expone el botón monocromo en dist/trabajo.html", () => {
    const css = pageCss("trabajo.html");
    assertMonochromeLoadButton(css, "dist/trabajo.html");
  });

  it("falla si vuelve el acento azul al botón", () => {
    const css = pageCss("trabajo.html");
    const mutated = css.replace(
      /background\s*:\s*var\(--neutro-text\)/i,
      "background: var(--neutro-accent-blue)",
    );
    assert.notEqual(mutated, css, "no se pudo inyectar el acento");
    assert.throws(
      () => assertMonochromeLoadButton(mutated, "mutación"),
      /acento|neutro-text/,
    );
    assertMonochromeLoadButton(css, "dist/trabajo.html");
  });
});
