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
  selector: "card" | "details";
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
        selector: "card",
      });
    }
    for (const match of body.matchAll(
      /\.work-card__details(?:\[data-astro-cid-[^\]]+\])?\s*\{([^}]*)\}/g,
    )) {
      const decls = match[1] ?? "";
      const pad = PADDING_INLINE.exec(decls);
      if (!pad) continue;
      rules.push({
        media,
        value: (pad[1] ?? "").trim().toLowerCase(),
        raw: match[0],
        selector: "details",
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

function assertWorkCardFlushImages(css: string, where: string): void {
  const rules = extractPaddingRules(css);
  const cardPads = rules.filter((rule) => rule.selector === "card");
  const detailPads = rules.filter((rule) => rule.selector === "details");

  assert.equal(
    cardPads.length,
    0,
    `${where}: .work-card no debe tener padding-inline (imágenes al borde); hay ${cardPads.length}: ${cardPads.map((r) => r.raw).join(" | ")}`,
  );
  assert.equal(
    detailPads.length,
    1,
    `${where}: se esperaba 1 padding-inline en .work-card__details; hay ${detailPads.length}: ${detailPads.map((r) => r.raw).join(" | ")}`,
  );
  assert.equal(
    detailPads[0]?.media,
    "none",
    `${where}: el padding del texto debe ser base (sin media); quedó ${detailPads[0]?.media}`,
  );
  assert.match(
    detailPads[0]?.value ?? "",
    /^var\(--landing-gutter\)$/,
    `${where}: .work-card__details debe usar var(--landing-gutter); quedó ${JSON.stringify(detailPads[0]?.value)}`,
  );
}

function withCardPaddingInjected(css: string): string {
  const injection =
    "@media (max-width: 1023px) { .work-card { padding-inline: 1rem; } }\n";
  return `${injection}${css}`;
}

function withDetailsPaddingRemoved(css: string): string {
  const next = css.replace(
    /(\.work-card__details(?:\[data-astro-cid-[^\]]+\])?\s*\{[^}]*?)padding-inline\s*:\s*var\(--landing-gutter\)\s*;?/gi,
    "$1",
  );
  assert.notEqual(
    next,
    css,
    "no se pudo quitar padding de .work-card__details",
  );
  return next;
}

describe("margen lateral de WorkCard en el dist", () => {
  it("exige imágenes sin padding en .work-card y texto con gutter", () => {
    for (const relativePath of WORK_CARD_PAGES) {
      const css = pageCss(relativePath);
      assert.match(
        css,
        /\.work-card(?!__)/,
        `dist/${relativePath} no trae estilos de .work-card`,
      );
      assertWorkCardFlushImages(css, `dist/${relativePath}`);
    }
    const pagesWithCards = readDistHtmlPages().filter((page) =>
      page.document.querySelector("li.work-card"),
    );
    assert.ok(
      pagesWithCards.length >= 3,
      `se esperaban páginas con li.work-card; hay ${pagesWithCards.length}`,
    );
  });

  it("falla si .work-card vuelve a tener padding-inline", () => {
    const css = pageCss("index.html");
    assert.throws(
      () => assertWorkCardFlushImages(withCardPaddingInjected(css), "mutación"),
      /padding-inline|imágenes al borde/,
    );
    assertWorkCardFlushImages(css, "dist/index.html");
  });

  it("falla si .work-card__details pierde el gutter del texto", () => {
    const css = pageCss("index.html");
    assert.throws(
      () =>
        assertWorkCardFlushImages(withDetailsPaddingRemoved(css), "mutación"),
      /work-card__details|landing-gutter/,
    );
    assertWorkCardFlushImages(css, "dist/index.html");
  });
});
