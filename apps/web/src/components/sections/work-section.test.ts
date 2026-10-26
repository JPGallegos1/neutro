import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const sectionPath = fileURLToPath(
  new URL("./WorkSection.astro", import.meta.url),
);
const cardPath = fileURLToPath(new URL("./WorkCard.astro", import.meta.url));
const sectionSource = readFileSync(sectionPath, "utf8");
const cardSource = readFileSync(cardPath, "utf8");

function extractStyle(source: string): string {
  const match = source.match(/<style>([\s\S]*)<\/style>/);
  const body = match?.[1];
  if (!body) throw new Error("missing <style>");
  return body;
}

function extractMarkup(source: string): string {
  const match = source.match(/^---[\s\S]*?---\s*([\s\S]*?)<style>/);
  const body = match?.[1];
  if (!body) throw new Error("missing markup");
  return body;
}

const sectionCss = extractStyle(sectionSource);
const cardCss = extractStyle(cardSource);
const sectionMarkup = extractMarkup(sectionSource);

describe("work section landing edge grid", () => {
  it("mantiene el título dentro del gutter y la grilla como hermana, no hija", () => {
    assert.match(
      sectionMarkup,
      /<div class="landing-gutter work__header">[\s\S]*?<\/div>\s*<ul class="work__grid">/,
    );
    const gutterOpen = sectionMarkup.indexOf(
      'class="landing-gutter work__header"',
    );
    const gutterClose = sectionMarkup.indexOf("</div>", gutterOpen);
    const gridOpen = sectionMarkup.indexOf('<ul class="work__grid">');
    assert.ok(gutterOpen >= 0);
    assert.ok(gutterClose > gutterOpen);
    assert.ok(gridOpen > gutterClose);
  });

  it("fuerza la grilla a sangre sin padding lateral ni gap", () => {
    assert.match(sectionCss, /\.work__grid\s*\{[^}]*padding:\s*0/);
    assert.match(sectionCss, /\.work__grid\s*\{[^}]*padding-inline:\s*0/);
    assert.match(sectionCss, /\.work__grid\s*\{[^}]*width:\s*100%/);
    assert.match(sectionCss, /\.work__grid\s*\{[^}]*column-gap:\s*0/);
    assert.match(sectionCss, /\.work__grid\s*\{[^}]*row-gap:\s*0/);
    assert.doesNotMatch(sectionCss, /border(?:-width)?:\s*1px/);
  });

  it("deja la preview sin padding ni borde 1px y el tag En producción intacto", () => {
    assert.match(cardSource, /class="work-card__tag"/);
    assert.match(cardCss, /\.work-card__preview\s*\{[^}]*overflow:\s*hidden/);
    assert.doesNotMatch(cardCss, /\.work-card__preview\s*\{[^}]*padding/);
    assert.doesNotMatch(cardCss, /\.work-card__preview\s*\{[^}]*border:\s*1px/);
    assert.match(
      cardCss,
      /\.work-card__tag\s*\{[^}]*top:\s*12px[^}]*left:\s*12px/,
    );
  });

  it("en desktop alinea el texto de la card con la imagen a sangre", () => {
    assert.match(
      cardCss,
      /@media \(min-width:\s*1024px\)\s*\{\s*\.work-card__details\s*\{[^}]*padding-inline:\s*0/,
    );
  });
});
