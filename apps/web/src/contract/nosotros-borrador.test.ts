import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

import { readDistPage } from "./dist.ts";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));
const DRAFT_LABEL = "Borrador de contenido";

function nosotrosHtml(): string {
  return readFileSync(join(distDir, "nosotros.html"), "utf8");
}

function assertNoDraftLabel(html: string, where: string): void {
  assert.ok(
    !html.includes(DRAFT_LABEL),
    `${where} contiene ${JSON.stringify(DRAFT_LABEL)}`,
  );
  const document = parse(html);
  const hits = document
    .querySelectorAll("body *")
    .filter((node) => node.text.trim() === DRAFT_LABEL);
  assert.equal(
    hits.length,
    0,
    `${where} tiene ${hits.length} nodo(s) con el texto del borrador`,
  );
}

function withDraftLabelReinserted(html: string): string {
  const marker = '<h1 class="nosotros__title"';
  const at = html.indexOf(marker);
  assert.ok(at >= 0, "no se encontró el h1 de /nosotros para mutar");
  const close = html.indexOf("</h1>", at);
  assert.ok(close > at, "no se cerró el h1 de /nosotros");
  const insertAt = close + "</h1>".length;
  return `${html.slice(0, insertAt)}<p class="nosotros__tag">${DRAFT_LABEL}</p>${html.slice(insertAt)}`;
}

describe("sin borrador de contenido en /nosotros", () => {
  it("no muestra «Borrador de contenido» en dist/nosotros.html", () => {
    const html = nosotrosHtml();
    assertNoDraftLabel(html, "dist/nosotros.html");
    assert.ok(
      readDistPage("nosotros.html").querySelector("h1"),
      "falta h1 en dist/nosotros.html",
    );
  });

  it("falla si se reinserta «Borrador de contenido» en /nosotros", () => {
    const html = nosotrosHtml();
    assertNoDraftLabel(html, "dist/nosotros.html");
    const mutated = withDraftLabelReinserted(html);
    assert.throws(
      () => assertNoDraftLabel(mutated, "mutación"),
      /Borrador de contenido/,
    );
  });
});
