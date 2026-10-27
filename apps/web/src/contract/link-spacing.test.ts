import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistHtmlPages } from "./dist.ts";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const GLUED_BEFORE_ANCHOR = /([A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9)])<a\b/g;
const LOOSE_AT = /@(?:\s*<a\b|\s+[a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi;

function readPageHtml(relativePath: string): string {
  return readFileSync(join(distDir, relativePath), "utf8");
}

function gluedBeforeAnchorProblems(
  html: string,
  relativePath: string,
  route: string,
): string[] {
  const problems: string[] = [];
  for (const match of html.matchAll(GLUED_BEFORE_ANCHOR)) {
    const ch = match[1] ?? "";
    const at = match.index ?? 0;
    const after = html.slice(at, Math.min(html.length, at + 80));
    const hrefMatch = /^.<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(
      after,
    );
    const href = hrefMatch?.[2] ?? hrefMatch?.[3] ?? "";
    const snippet = html
      .slice(Math.max(0, at - 28), Math.min(html.length, at + 56))
      .replace(/\s+/g, " ");
    problems.push(
      `dist/${relativePath} ruta ${route} pegado=${JSON.stringify(ch)} href=${JSON.stringify(href)} …${snippet}…`,
    );
  }
  return problems;
}

function looseAtProblems(
  html: string,
  relativePath: string,
  route: string,
): string[] {
  const problems: string[] = [];
  for (const match of html.matchAll(LOOSE_AT)) {
    const at = match.index ?? 0;
    const snippet = html
      .slice(Math.max(0, at - 24), Math.min(html.length, at + 64))
      .replace(/\s+/g, " ");
    problems.push(
      `dist/${relativePath} ruta ${route} arroba-suelta=${JSON.stringify(match[0])} …${snippet}…`,
    );
  }
  return problems;
}

function assertNoGluedBeforeAnchor(
  html: string,
  relativePath: string,
  route: string,
): void {
  assert.deepEqual(
    gluedBeforeAnchorProblems(html, relativePath, route),
    [],
    gluedBeforeAnchorProblems(html, relativePath, route).join("\n"),
  );
}

function assertNoLooseAt(
  html: string,
  relativePath: string,
  route: string,
): void {
  const problems = looseAtProblems(html, relativePath, route);
  assert.deepEqual(problems, [], problems.join("\n"));
}

function withAtOutsideLink(html: string): string {
  const needle =
    '(siempre termina en\n<a href="https://neutro.solutions">@neutro.solutions</a>)';
  const replacement =
    '(siempre termina en @\n<a href="https://neutro.solutions">neutro.solutions</a>)';
  assert.ok(
    html.includes(needle) ||
      html.includes(
        '(siempre termina en <a href="https://neutro.solutions">@neutro.solutions</a>)',
      ),
    "no se encontró el enlace @neutro.solutions para mutar",
  );
  if (html.includes(needle)) {
    return html.replace(needle, replacement);
  }
  return html.replace(
    '(siempre termina en <a href="https://neutro.solutions">@neutro.solutions</a>)',
    '(siempre termina en @ <a href="https://neutro.solutions">neutro.solutions</a>)',
  );
}

describe("espacios antes de enlaces y mails en el dist", () => {
  it("no pega letra, dígito ni ) inmediatamente antes de un <a>", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages()) {
      const html = readPageHtml(page.relativePath);
      problems.push(
        ...gluedBeforeAnchorProblems(html, page.relativePath, page.route),
      );
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("no deja un @ suelto separado de su dominio por espacio o por el borde del enlace", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages()) {
      const html = readPageHtml(page.relativePath);
      problems.push(...looseAtProblems(html, page.relativePath, page.route));
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("falla si el @ de alerta-estafa queda fuera del enlace antes del dominio", () => {
    const html = readPageHtml("alerta-estafa.html");
    assertNoLooseAt(html, "alerta-estafa.html", "/alerta-estafa");
    const mutated = withAtOutsideLink(html);
    assert.throws(
      () => assertNoLooseAt(mutated, "alerta-estafa.html", "/alerta-estafa"),
      /arroba-suelta/,
    );
    assert.match(mutated, /@\s*<a\b/);
    assertNoGluedBeforeAnchor(html, "alerta-estafa.html", "/alerta-estafa");
  });
});
