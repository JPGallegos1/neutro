import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistHtmlPages } from "./dist.ts";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const GLUED_BEFORE_ANCHOR = /([A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9)])<a\b/g;
const LOOSE_AT = /@(?:\s*<a\b|\s+[a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi;
const INLINE_CLOSE = "a|code|strong|em|span";
const SPACE_BEFORE_PUNCT = new RegExp(
  `</(?:${INLINE_CLOSE})>(\\s+)([.,;:)!?»”…])`,
  "gi",
);
const SPACE_AFTER_OPENER = new RegExp(
  `([(\\u00ab])(\\s+)<(?:${INLINE_CLOSE})\\b`,
  "gi",
);

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

function punctuationSpacingProblems(
  html: string,
  relativePath: string,
  route: string,
): string[] {
  const problems: string[] = [];
  SPACE_BEFORE_PUNCT.lastIndex = 0;
  for (const match of html.matchAll(SPACE_BEFORE_PUNCT)) {
    const at = match.index ?? 0;
    const snippet = html
      .slice(Math.max(0, at - 28), Math.min(html.length, at + 40))
      .replace(/\s+/g, " ");
    problems.push(
      `dist/${relativePath} ruta ${route} espacio-antes-puntuacion=${JSON.stringify(match[2])} …${snippet}…`,
    );
  }
  SPACE_AFTER_OPENER.lastIndex = 0;
  for (const match of html.matchAll(SPACE_AFTER_OPENER)) {
    const at = match.index ?? 0;
    const opener = match[1] ?? "";
    const snippet = html
      .slice(Math.max(0, at - 20), Math.min(html.length, at + 48))
      .replace(/\s+/g, " ");
    problems.push(
      `dist/${relativePath} ruta ${route} espacio-despues-de-apertura=${JSON.stringify(opener)} …${snippet}…`,
    );
  }
  return problems;
}

function assertNoPunctuationSpacing(
  html: string,
  relativePath: string,
  route: string,
): void {
  const problems = punctuationSpacingProblems(html, relativePath, route);
  assert.deepEqual(problems, [], problems.join("\n"));
}

function withSpaceBeforePunctuation(html: string): string {
  const needle = '<a href="/cookies"><strong>Política de cookies</strong></a>.';
  const replacement =
    '<a href="/cookies"><strong>Política de cookies</strong></a>\n.';
  assert.ok(
    html.includes(needle),
    "no se encontró «Política de cookies</a>.» en privacidad para mutar",
  );
  return html.replace(needle, replacement);
}

function withSpaceAfterOpenParen(html: string): string {
  const needle = "dominio (<code>neutro.solutions/ingest</code>)";
  const replacement = "dominio (\n<code>neutro.solutions/ingest</code>)";
  assert.ok(
    html.includes(needle),
    "no se encontró «dominio (<code>…» en cookies para mutar",
  );
  return html.replace(needle, replacement);
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

  it("no deja espacio ni salto de línea antes de puntuación tras cierres inline ni tras ( o «", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages()) {
      const html = readPageHtml(page.relativePath);
      problems.push(
        ...punctuationSpacingProblems(html, page.relativePath, page.route),
      );
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("falla si aparece espacio o salto antes de puntuación tras un cierre inline", () => {
    const html = readPageHtml("privacidad.html");
    assertNoPunctuationSpacing(html, "privacidad.html", "/privacidad");
    const mutated = withSpaceBeforePunctuation(html);
    assert.throws(
      () =>
        assertNoPunctuationSpacing(mutated, "privacidad.html", "/privacidad"),
      /espacio-antes-puntuacion/,
    );
    assert.match(mutated, /<\/a>\s+\./);
  });

  it("falla si aparece espacio o salto entre ( o « y un cierre inline", () => {
    const html = readPageHtml("cookies.html");
    assertNoPunctuationSpacing(html, "cookies.html", "/cookies");
    const mutatedParen = withSpaceAfterOpenParen(html);
    assert.throws(
      () =>
        assertNoPunctuationSpacing(mutatedParen, "cookies.html", "/cookies"),
      /espacio-despues-de-apertura/,
    );
    assert.match(mutatedParen, /\(\s+<code\b/);
    const mutatedGuillemet = html.replace(
      "dominio (<code>neutro.solutions/ingest</code>)",
      "dominio «\n<code>neutro.solutions/ingest</code>»",
    );
    assert.throws(
      () =>
        assertNoPunctuationSpacing(
          mutatedGuillemet,
          "cookies.html",
          "/cookies",
        ),
      /espacio-despues-de-apertura/,
    );
  });

  it("falla si hay espacio antes de ! ? » ” … tras </em> o </span>", () => {
    const base = "<p>texto</p>";
    const mutatedEm = `${base}<em>hola</em>\n!`;
    assert.throws(
      () => assertNoPunctuationSpacing(mutatedEm, "mut.html", "/mut"),
      /espacio-antes-puntuacion/,
    );
    const mutatedSpan = `${base}<span>hola</span>\n…`;
    assert.throws(
      () => assertNoPunctuationSpacing(mutatedSpan, "mut.html", "/mut"),
      /espacio-antes-puntuacion/,
    );
  });
});
