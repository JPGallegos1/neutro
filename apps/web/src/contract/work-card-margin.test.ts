import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistHtmlPages } from "./dist.ts";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const WORK_CARD_PAGES = [
  "index.html",
  "trabajo.html",
  "trabajo/capa-automotores.html",
];

const PADDING_INLINE = /padding-inline\s*:\s*([^;}\s]+)/i;

type MediaKind = "mobile" | "desktop" | "other" | "none";

type PaddingRule = {
  media: MediaKind;
  value: string;
  raw: string;
};

function pageCss(relativePath: string): string {
  const html = readFileSync(join(distDir, relativePath), "utf8");
  const blocks: string[] = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push(match[1] ?? "");
  }
  return blocks.join("\n");
}

function mediaKind(query: string): MediaKind {
  const normalized = query.replace(/\s+/g, "");
  if (
    /(?:max-width:1023px|width<=1023px)/i.test(normalized) ||
    /(?:max-width:1023\.98px|width<=1023\.98px)/i.test(normalized)
  ) {
    return "mobile";
  }
  if (
    /(?:min-width:1024px|width>=1024px)/i.test(normalized) ||
    /(?:min-width:1023\.99px|width>=1023\.99px)/i.test(normalized)
  ) {
    return "desktop";
  }
  return "other";
}

function extractPaddingRules(css: string): PaddingRule[] {
  const rules: PaddingRule[] = [];
  const mediaSpans: {
    start: number;
    end: number;
    kind: MediaKind;
    body: string;
  }[] = [];
  for (const match of css.matchAll(/@media\s*([^{]+)\{/gi)) {
    const query = match[1] ?? "";
    const open = (match.index ?? 0) + match[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let index = open; index < css.length; index += 1) {
      const char = css[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    if (end === -1) continue;
    mediaSpans.push({
      start: match.index ?? 0,
      end,
      kind: mediaKind(query),
      body: css.slice(open + 1, end - 1),
    });
  }

  function collect(body: string, media: MediaKind) {
    for (const match of body.matchAll(
      /\.work-card(?!__)(?:\[data-astro-cid-[^\]]+\])?\s*\{([^}]*)\}/g,
    )) {
      const decls = match[1] ?? "";
      const pad = PADDING_INLINE.exec(decls);
      if (!pad) continue;
      rules.push({
        media,
        value: (pad[1] ?? "").trim().toLowerCase(),
        raw: match[0],
      });
    }
  }

  let cursor = 0;
  for (const span of mediaSpans) {
    if (cursor < span.start) {
      collect(css.slice(cursor, span.start), "none");
    }
    collect(span.body, span.kind);
    cursor = span.end;
  }
  if (cursor < css.length) {
    collect(css.slice(cursor), "none");
  }

  return rules;
}

function assertWorkCardMobileMargin(css: string, where: string): void {
  const rules = extractPaddingRules(css);
  const mobile = rules.filter((rule) => rule.media === "mobile");
  const desktop = rules.filter((rule) => rule.media === "desktop");
  const unscoped = rules.filter((rule) => rule.media === "none");
  const other = rules.filter((rule) => rule.media === "other");

  assert.equal(
    mobile.length,
    1,
    `${where}: se esperaba 1 regla mobile de padding-inline en .work-card; hay ${mobile.length}: ${mobile.map((r) => r.raw).join(" | ")}`,
  );
  assert.equal(
    mobile[0]?.value,
    "1rem",
    `${where}: padding-inline mobile debe ser 1rem; quedó ${JSON.stringify(mobile[0]?.value)}`,
  );
  assert.equal(
    desktop.length,
    0,
    `${where}: .work-card no debe tener padding-inline desde 1024px; hay ${desktop.length}: ${desktop.map((r) => r.raw).join(" | ")}`,
  );
  assert.equal(
    unscoped.length,
    0,
    `${where}: .work-card no debe tener padding-inline fuera de media mobile; hay ${unscoped.length}: ${unscoped.map((r) => r.raw).join(" | ")}`,
  );
  assert.equal(
    other.length,
    0,
    `${where}: .work-card no debe tener padding-inline en otros breakpoints; hay ${other.length}: ${other.map((r) => r.raw).join(" | ")}`,
  );
}

function withMobilePaddingRemoved(css: string): string {
  const next = css.replace(
    /@media\s*\((?:max-width:\s*1023px|width\s*<=\s*1023px)\)\s*\{\s*\.work-card(?!__)(?:\[data-astro-cid-[^\]]+\])?\s*\{\s*padding-inline\s*:\s*1rem\s*;?\s*\}\s*\}/gi,
    "",
  );
  assert.notEqual(
    next,
    css,
    "no se pudo quitar el padding mobile de .work-card",
  );
  return next;
}

function withMobilePaddingOnDesktop(css: string): string {
  const next = css.replace(
    /@media\s*\((?:max-width:\s*1023px|width\s*<=\s*1023px)\)/gi,
    "@media (width>=1024px)",
  );
  assert.notEqual(next, css, "no se pudo mover el media a desktop");
  assert.match(
    next,
    /@media\s*\(width>=1024px\)\s*\{[^}]*\.work-card(?!__)[^}]*padding-inline\s*:\s*1rem/i,
  );
  return next;
}

function withHalfRemPadding(css: string): string {
  const next = css.replace(
    /(\.work-card(?!__)(?:\[data-astro-cid-[^\]]+\])?\s*\{[^}]*padding-inline\s*:\s*)1rem/gi,
    (_full, prefix: string) => `${prefix}0.5rem`,
  );
  assert.notEqual(next, css, "no se pudo cambiar 1rem a 0.5rem");
  assert.match(next, /padding-inline\s*:\s*0\.5rem/i);
  return next;
}

describe("margen lateral de WorkCard en el dist", () => {
  it("exige padding-inline 1rem bajo 1024px y ninguno desde 1024px", () => {
    for (const relativePath of WORK_CARD_PAGES) {
      const css = pageCss(relativePath);
      assert.match(
        css,
        /\.work-card(?!__)/,
        `dist/${relativePath} no trae estilos de .work-card`,
      );
      assertWorkCardMobileMargin(css, `dist/${relativePath}`);
    }
    const pagesWithCards = readDistHtmlPages().filter((page) =>
      page.document.querySelector("li.work-card"),
    );
    assert.ok(
      pagesWithCards.length >= 3,
      `se esperaban páginas con li.work-card; hay ${pagesWithCards.length}`,
    );
  });

  it("falla si se quita el padding-inline mobile de .work-card", () => {
    const css = pageCss("index.html");
    assert.throws(
      () =>
        assertWorkCardMobileMargin(withMobilePaddingRemoved(css), "mutación"),
      /1 regla mobile|padding-inline/,
    );
    assertWorkCardMobileMargin(css, "dist/index.html");
  });

  it("falla si el padding-inline de .work-card aplica desde 1024px", () => {
    const css = pageCss("index.html");
    assert.throws(
      () =>
        assertWorkCardMobileMargin(withMobilePaddingOnDesktop(css), "mutación"),
      /desde 1024px|1 regla mobile/,
    );
    assertWorkCardMobileMargin(css, "dist/index.html");
  });

  it("falla si el padding-inline mobile no es 1rem", () => {
    const css = pageCss("index.html");
    assert.throws(
      () => assertWorkCardMobileMargin(withHalfRemPadding(css), "mutación"),
      /1rem/,
    );
    assertWorkCardMobileMargin(css, "dist/index.html");
  });
});
