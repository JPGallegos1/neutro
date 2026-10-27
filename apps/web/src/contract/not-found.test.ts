import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HTMLElement } from "node-html-parser";
import { parse } from "node-html-parser";

import { readDistPage } from "./dist.ts";

const EXPECTED_TITLE = "Página no encontrada | Neutro Solutions";
const EXPECTED_H1 = "Esta página no existe";
const EXPECTED_LANG = "es";
const EXPECTED_HOME_CTA = "Volver al inicio";

function page404(): HTMLElement {
  return readDistPage("404.html");
}

function isNoindex(document: HTMLElement): boolean {
  return document.querySelectorAll("meta").some((meta) => {
    const name = (meta.getAttribute("name") ?? "").toLowerCase();
    if (name !== "robots" && name !== "googlebot") return false;
    const tokens = (meta.getAttribute("content") ?? "")
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((token) => token.length > 0);
    return tokens.includes("noindex");
  });
}

function canonicalHrefs(document: HTMLElement): string[] {
  return document.querySelectorAll("link").flatMap((link) => {
    const rel = (link.getAttribute("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0);
    if (!rel.includes("canonical")) return [];
    return [link.getAttribute("href") ?? ""];
  });
}

function jsonLdScripts(document: HTMLElement): HTMLElement[] {
  return document.querySelectorAll('script[type="application/ld+json"]');
}

function notFoundRoot(document: HTMLElement): HTMLElement {
  const main = document.querySelector("main#contenido.not-found, main#contenido");
  assert.ok(main, 'dist/404.html debe tener <main id="contenido">');
  return main;
}

function homeCtaInContent(document: HTMLElement): HTMLElement | null {
  const main = notFoundRoot(document);
  return (
    main.querySelectorAll("a").find((anchor) => {
      if ((anchor.getAttribute("href") ?? "") !== "/") return false;
      return anchor.text.trim() === EXPECTED_HOME_CTA;
    }) ?? null
  );
}

function assertNotFoundContract(document: HTMLElement): void {
  const html = document.querySelector("html");
  assert.ok(html, "dist/404.html debe tener <html>");
  assert.equal(
    html.getAttribute("lang"),
    EXPECTED_LANG,
    `dist/404.html <html lang> = ${JSON.stringify(html.getAttribute("lang"))}; se exige ${JSON.stringify(EXPECTED_LANG)}`,
  );

  const titles = document.querySelectorAll("title").map((node) => node.text.trim());
  assert.equal(
    titles.length,
    1,
    `dist/404.html debe tener un solo <title>; hay ${titles.length}`,
  );
  assert.equal(
    titles[0],
    EXPECTED_TITLE,
    `dist/404.html title=${JSON.stringify(titles[0])}; se exige ${JSON.stringify(EXPECTED_TITLE)}`,
  );

  assert.ok(
    isNoindex(document),
    'dist/404.html debe incluir <meta name="robots" content="noindex">',
  );

  const canonicals = canonicalHrefs(document);
  assert.deepEqual(
    canonicals,
    [],
    `dist/404.html no debe tener canonical; hay ${canonicals.join(", ")}`,
  );

  assert.equal(
    jsonLdScripts(document).length,
    0,
    "dist/404.html no debe incluir JSON-LD",
  );

  const headings = document.querySelectorAll("h1");
  assert.equal(
    headings.length,
    1,
    `dist/404.html debe tener un solo h1; hay ${headings.length}`,
  );
  assert.equal(
    headings[0]?.text.trim(),
    EXPECTED_H1,
    `dist/404.html h1=${JSON.stringify(headings[0]?.text.trim())}; se exige ${JSON.stringify(EXPECTED_H1)}`,
  );

  const homeCta = homeCtaInContent(document);
  assert.ok(
    homeCta,
    `dist/404.html debe tener en main#contenido un <a href="/"> con texto ${JSON.stringify(EXPECTED_HOME_CTA)}`,
  );

  const work = document.querySelector('a[href="/trabajo"]');
  const mail = document.querySelector('a[href="mailto:hola@neutro.solutions"]');
  assert.ok(work, 'dist/404.html debe enlazar href="/trabajo"');
  assert.ok(mail, 'dist/404.html debe enlazar mailto:hola@neutro.solutions');

  const tag = [...document.querySelectorAll("[aria-hidden]")].find((el) =>
    el.text.trim().toUpperCase().includes("ERROR 404"),
  );
  assert.ok(tag, "la etiqueta ERROR 404 debe tener aria-hidden");

  const frames = document.querySelectorAll(".not-found__frame");
  assert.ok(frames.length >= 1, "debe existir el marco .not-found__frame");
  for (const frame of frames) {
    assert.equal(
      frame.getAttribute("aria-hidden"),
      "true",
      'los marcos deben tener aria-hidden="true"',
    );
  }

  assert.ok(
    document.querySelector("header.site-header, header"),
    "dist/404.html debe incluir el header del sitio",
  );
  assert.ok(
    document.querySelector("footer.site-footer, footer"),
    "dist/404.html debe incluir el footer del sitio",
  );
  assert.ok(
    document.querySelector('a.skip-link[href="#contenido"], a[href="#contenido"]'),
    "dist/404.html debe conservar el skip link a #contenido",
  );
}

function withMutatedH1(html: string): string {
  return html.replace(
    ">Esta página no existe<",
    ">Esta página sí existe<",
  );
}

function withoutNoindex(document: HTMLElement): HTMLElement {
  for (const meta of document.querySelectorAll("meta")) {
    const name = (meta.getAttribute("name") ?? "").toLowerCase();
    if (name === "robots" || name === "googlebot") {
      meta.remove();
    }
  }
  return document;
}

function withCanonical(document: HTMLElement): HTMLElement {
  const head = document.querySelector("head");
  assert.ok(head, "falta <head> en el HTML mutado");
  head.insertAdjacentHTML(
    "beforeend",
    '<link rel="canonical" href="https://neutro.solutions/404" />',
  );
  return document;
}

function withoutHomeCta(document: HTMLElement): HTMLElement {
  const cta = homeCtaInContent(document);
  assert.ok(cta, "no se encontró el CTA a mutar");
  cta.remove();
  return document;
}

function withoutLang(document: HTMLElement): HTMLElement {
  const html = document.querySelector("html");
  assert.ok(html, "falta <html> en el HTML mutado");
  html.removeAttribute("lang");
  return document;
}

describe("contrato 404 del dist", () => {
  it("exige title, noindex, sin canonical ni JSON-LD, un h1, tres enlaces, aria-hidden, header y footer", () => {
    assertNotFoundContract(page404());
  });

  it("falla si se cambia el h1", () => {
    const html = page404().toString();
    const mutated = parse(withMutatedH1(html));
    assert.throws(() => assertNotFoundContract(mutated), /h1=/);
  });

  it("falla si se quita noindex", () => {
    const mutated = withoutNoindex(parse(page404().toString()));
    assert.throws(() => assertNotFoundContract(mutated), /noindex/);
  });

  it("falla si se agrega canonical", () => {
    const mutated = withCanonical(parse(page404().toString()));
    assert.throws(() => assertNotFoundContract(mutated), /canonical/);
  });

  it("falla si se quita el CTA Volver al inicio del contenido", () => {
    const mutated = withoutHomeCta(parse(page404().toString()));
    assert.throws(
      () => assertNotFoundContract(mutated),
      /Volver al inicio/,
    );
    assertNotFoundContract(page404());
  });

  it("falla si se quita lang del html", () => {
    const mutated = withoutLang(parse(page404().toString()));
    assert.throws(
      () => assertNotFoundContract(mutated),
      /<html lang>/,
    );
    assertNotFoundContract(page404());
  });
});
