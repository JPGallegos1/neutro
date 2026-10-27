import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { HTMLElement, TextNode } from "node-html-parser";
import { parse } from "node-html-parser";

import { readDistHtmlPages, type DistHtmlPage } from "./dist.ts";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const ALLOWED_VISIBLE_BORRADOR: ReadonlySet<string> = new Set();

const BORRADOR_WORD = /\bborrador\b/iu;

function isElement(node: { nodeType: number }): node is HTMLElement {
  return node.nodeType === 1;
}

function isText(node: { nodeType: number }): node is TextNode {
  return node.nodeType === 3;
}

function normalizeVisibleText(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&#(?:160|x0*a0);/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-AR");
}

function visibleTextFrom(root: HTMLElement): string {
  const parts: string[] = [];
  const walk = (node: HTMLElement | TextNode) => {
    if (isText(node)) {
      parts.push(node.rawText);
      return;
    }
    if (!isElement(node)) return;
    const tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return;
    for (const child of node.childNodes) {
      walk(child as HTMLElement | TextNode);
    }
  };
  walk(root);
  return normalizeVisibleText(parts.join(" "));
}

function borradorProblems(page: DistHtmlPage): string[] {
  const body = page.document.querySelector("body") ?? page.document;
  const visible = visibleTextFrom(body);
  if (!BORRADOR_WORD.test(visible)) return [];
  if (ALLOWED_VISIBLE_BORRADOR.has(page.route)) {
    return [];
  }
  const match = visible.match(BORRADOR_WORD);
  return [
    `dist/${page.relativePath} ruta ${page.route} visible=${JSON.stringify(match?.[0] ?? "borrador")}`,
  ];
}

function assertNoVisibleBorrador(pages: DistHtmlPage[]): void {
  const problems = pages.flatMap((page) => borradorProblems(page));
  assert.deepEqual(problems, [], problems.join("\n"));
}

function pageFromHtml(
  relativePath: string,
  route: string,
  html: string,
): DistHtmlPage {
  return {
    relativePath,
    route,
    document: parse(html),
  };
}

function readRaw(relativePath: string): string {
  return readFileSync(join(distDir, relativePath), "utf8");
}

function withInsertedInMain(
  html: string,
  relativePath: string,
  snippet: string,
): string {
  const marker = "<main";
  const at = html.indexOf(marker);
  assert.ok(at >= 0, `dist/${relativePath} no tiene <main> para mutar`);
  const openEnd = html.indexOf(">", at);
  assert.ok(openEnd > at, `dist/${relativePath}: no se cerró <main>`);
  return `${html.slice(0, openEnd + 1)}${snippet}${html.slice(openEnd + 1)}`;
}

describe("sin «borrador» visible en el dist", () => {
  it("no muestra la palabra borrador en ninguna ruta HTML del dist", () => {
    assert.equal(ALLOWED_VISIBLE_BORRADOR.size, 0);
    assertNoVisibleBorrador(readDistHtmlPages());
  });

  it("falla si «Borrador de contenido» aparece en la home", () => {
    const html = readRaw("index.html");
    const mutated = withInsertedInMain(
      html,
      "index.html",
      "<p>Borrador de contenido</p>",
    );
    assert.throws(
      () => assertNoVisibleBorrador([pageFromHtml("index.html", "/", mutated)]),
      /ruta \//,
    );
  });

  it("falla si aparece solo «Borrador»", () => {
    const html = readRaw("nosotros.html");
    const mutated = withInsertedInMain(
      html,
      "nosotros.html",
      "<p>Borrador</p>",
    );
    assert.throws(
      () =>
        assertNoVisibleBorrador([
          pageFromHtml("nosotros.html", "/nosotros", mutated),
        ]),
      /nosotros/,
    );
  });

  it("falla si aparece en mayúsculas", () => {
    const html = readRaw("nosotros.html");
    const mutated = withInsertedInMain(
      html,
      "nosotros.html",
      "<p>BORRADOR DE CONTENIDO</p>",
    );
    assert.throws(
      () =>
        assertNoVisibleBorrador([
          pageFromHtml("nosotros.html", "/nosotros", mutated),
        ]),
      /nosotros/,
    );
  });

  it("falla si aparece con espacios múltiples", () => {
    const html = readRaw("nosotros.html");
    const mutated = withInsertedInMain(
      html,
      "nosotros.html",
      "<p>Borrador  de   contenido</p>",
    );
    assert.throws(
      () =>
        assertNoVisibleBorrador([
          pageFromHtml("nosotros.html", "/nosotros", mutated),
        ]),
      /nosotros/,
    );
  });

  it("falla si aparece con &nbsp;", () => {
    const html = readRaw("nosotros.html");
    const mutated = withInsertedInMain(
      html,
      "nosotros.html",
      "<p>Borrador&nbsp;de&nbsp;contenido</p>",
    );
    assert.throws(
      () =>
        assertNoVisibleBorrador([
          pageFromHtml("nosotros.html", "/nosotros", mutated),
        ]),
      /nosotros/,
    );
  });
});
