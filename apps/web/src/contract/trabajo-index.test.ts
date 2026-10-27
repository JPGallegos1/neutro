import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HTMLElement } from "node-html-parser";

import { pageMeta } from "../data/page-meta.ts";
import { readDistPage } from "./dist.ts";

const SITE = "https://neutro.solutions";
const INDEX_CANONICAL = "https://neutro.solutions/trabajo";
const PUBLISHED_CASE_PATHS = [
  "/trabajo/conexion-laboral",
  "/trabajo/afectiva",
  "/trabajo/capa-automotores",
  "/trabajo/suplementacion-ciencia",
  "/trabajo/luxurycars",
] as const;
const LANDING_CARDS = 4;
const HIDE_CLASSES = ["is-collapsed", "is-enhanced"] as const;

function casePaths(root: HTMLElement): string[] {
  return root.querySelectorAll("a").flatMap((anchor) => {
    const href = anchor.getAttribute("href");
    if (href === undefined) return [];
    const url = new URL(href, SITE);
    if (!/^\/trabajo\/[a-z0-9-]+$/.test(url.pathname)) return [];
    return [url.pathname];
  });
}

function elementHrefs(root: HTMLElement, tag: "a" | "link"): string[] {
  return root.querySelectorAll(tag).flatMap((el) => {
    const href = el.getAttribute("href");
    return href === undefined ? [] : [href];
  });
}

function isInternalHref(href: string): boolean {
  if (href.startsWith("//")) return false;
  if (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("?") ||
    !/^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return true;
  }
  try {
    return new URL(href).origin === SITE;
  } catch {
    return true;
  }
}

function styleValue(style: string, propName: string): string | undefined {
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;
    const prop = declaration.slice(0, colon).trim().toLowerCase();
    if (prop !== propName) continue;
    return declaration
      .slice(colon + 1)
      .trim()
      .toLowerCase()
      .replace(/\s*!important\s*$/, "")
      .trim();
  }
  return undefined;
}

function opacityIsZero(value: string): boolean {
  const numeric = value.endsWith("%")
    ? Number(value.slice(0, -1)) / 100
    : Number(value);
  return value !== "" && Number.isFinite(numeric) && numeric === 0;
}

function foldLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nodeLabel(node: HTMLElement): string {
  const tag = node.tagName.toLowerCase();
  const className = node.getAttribute("class");
  const href = node.getAttribute("href");
  const style = node.getAttribute("style");
  const ariaHidden = node.getAttribute("aria-hidden");
  const parts = [`<${tag}`];
  if (className) parts.push(` class="${className}"`);
  if (href) parts.push(` href="${href}"`);
  if (style) parts.push(` style="${style}"`);
  if (ariaHidden !== undefined) parts.push(` aria-hidden="${ariaHidden}"`);
  if (node.hasAttribute("hidden")) parts.push(" hidden");
  return `${parts.join("")}>`;
}

function cardScope(card: HTMLElement): HTMLElement[] {
  const nodes = [card, ...card.querySelectorAll("*")];
  let parent = card.parentNode;
  while (parent) {
    nodes.push(parent);
    if (parent.hasAttribute("data-work-grid") || parent.tagName === "UL") {
      break;
    }
    parent = parent.parentNode;
  }
  return nodes;
}

function assertCaseStaysVisible(root: HTMLElement, path: string): void {
  const anchor = root.querySelector(`a[href="${path}"]`);
  const card = anchor?.closest("li.work-card");
  assert.ok(
    card,
    `dist/trabajo.html no tiene card para ${path}; el caso no puede faltar ni quedar fuera de la lista`,
  );
  for (const node of cardScope(card)) {
    assert.ok(
      !node.hasAttribute("hidden"),
      `${path} queda oculto: hidden en ${nodeLabel(node)}`,
    );
    const ariaHidden = node.getAttribute("aria-hidden");
    assert.ok(
      ariaHidden?.toLowerCase() !== "true",
      `${path} queda oculto: aria-hidden="true" en ${nodeLabel(node)}`,
    );
    const style = node.getAttribute("style") ?? "";
    assert.notEqual(
      styleValue(style, "display"),
      "none",
      `${path} queda oculto: style inline display:none en ${nodeLabel(node)}`,
    );
    assert.notEqual(
      styleValue(style, "visibility"),
      "hidden",
      `${path} queda oculto: style inline visibility:hidden en ${nodeLabel(node)}`,
    );
    const opacity = styleValue(style, "opacity");
    assert.ok(
      opacity === undefined || !opacityIsZero(opacity),
      `${path} queda oculto: style inline opacity:0 en ${nodeLabel(node)}`,
    );
  }
}

describe("dist/trabajo.html", () => {
  it("incluye exactamente los 5 paths /trabajo/<slug> del ADR 0005", () => {
    const found = casePaths(readDistPage("trabajo.html"));
    const expected = [...PUBLISHED_CASE_PATHS];
    assert.equal(
      found.length,
      expected.length,
      `dist/trabajo.html tiene ${found.length} links a /trabajo/<slug> (${found.join(", ")}); se exigen ${expected.length}: ${expected.join(", ")}`,
    );
    assert.deepEqual(
      found,
      expected,
      `los links de dist/trabajo.html (${found.join(", ")}) no son los paths fijos del ADR 0005 (${expected.join(", ")})`,
    );
  });

  it("tiene un solo canonical https://neutro.solutions/trabajo sin query ni fragmento", () => {
    const root = readDistPage("trabajo.html");
    const canonicals = root.querySelectorAll("link").flatMap((el) => {
      const rel = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
      if (!rel.includes("canonical")) return [];
      return [el.getAttribute("href") ?? ""];
    });
    assert.equal(
      canonicals.length,
      1,
      `dist/trabajo.html tiene ${canonicals.length} <link rel="canonical"> (${canonicals.join(", ")}); se exige uno`,
    );
    const href = canonicals[0] ?? "";
    const url = new URL(href, SITE);
    assert.equal(
      url.search,
      "",
      `el canonical tiene query ${url.search} en ${href}; se exige ${INDEX_CANONICAL}`,
    );
    assert.equal(
      url.hash,
      "",
      `el canonical tiene fragmento ${url.hash} en ${href}; se exige ${INDEX_CANONICAL}`,
    );
    assert.equal(
      href,
      INDEX_CANONICAL,
      `el canonical es ${href}; se exige ${INDEX_CANONICAL}`,
    );
    assert.equal(
      href,
      pageMeta.trabajo.canonical,
      `el canonical del HTML (${href}) no coincide con pageMeta.trabajo.canonical (${pageMeta.trabajo.canonical})`,
    );
  });

  it("no pone ?page= ni query page en los href de a y link", () => {
    const root = readDistPage("trabajo.html");
    const hrefs = [...elementHrefs(root, "a"), ...elementHrefs(root, "link")];
    const offenders = hrefs.flatMap((href) => {
      if (href.includes("?page=")) return [`?page= en ${href}`];
      if (!isInternalHref(href)) return [];
      const url = new URL(href, SITE);
      if (url.searchParams.has("page"))
        return [`query page en href interno ${href}`];
      return [];
    });
    assert.deepEqual(
      offenders,
      [],
      `dist/trabajo.html tiene paginación en hrefs: ${offenders.join("; ")}`,
    );
  });

  it("deja los casos visibles sin JS y el botón Cargar más hidden", () => {
    const root = readDistPage("trabajo.html");
    for (const el of root.querySelectorAll("[class]")) {
      for (const name of HIDE_CLASSES) {
        assert.ok(
          !el.classList.contains(name),
          `dist/trabajo.html trae la clase ${name} en ${nodeLabel(el)}; sin JS esa clase no puede estar en el markup`,
        );
      }
    }

    for (const path of PUBLISHED_CASE_PATHS) {
      assertCaseStaysVisible(root, path);
    }

    const buttons = root
      .querySelectorAll("button")
      .filter((el) => foldLabel(el.text) === "cargar mas");
    const button = buttons[0];
    assert.ok(
      button,
      `falta el botón «Cargar más» en dist/trabajo.html (hay ${buttons.length})`,
    );
    assert.equal(
      buttons.length,
      1,
      `dist/trabajo.html tiene ${buttons.length} botones «Cargar más»; se exige uno`,
    );
    assert.ok(
      button.hasAttribute("hidden"),
      "el botón «Cargar más» está en el HTML estático sin el atributo hidden",
    );
  });

  it("muestra 4 cards en dist/index.html y 5 en dist/trabajo.html", () => {
    const homeCards =
      readDistPage("index.html").querySelectorAll("li.work-card");
    const trabajoCards =
      readDistPage("trabajo.html").querySelectorAll("li.work-card");
    const homeHrefs = casePaths(readDistPage("index.html"));
    const landingPaths = [...PUBLISHED_CASE_PATHS.slice(0, LANDING_CARDS)];
    assert.equal(
      homeCards.length,
      LANDING_CARDS,
      `dist/index.html tiene ${homeCards.length} cards; la home muestra ${LANDING_CARDS}`,
    );
    assert.deepEqual(
      homeHrefs,
      landingPaths,
      `las cards de dist/index.html (${homeHrefs.join(", ")}) no son las primeras ${LANDING_CARDS} del ADR 0005 (${landingPaths.join(", ")})`,
    );
    assert.equal(
      trabajoCards.length,
      PUBLISHED_CASE_PATHS.length,
      `dist/trabajo.html tiene ${trabajoCards.length} cards; /trabajo muestra ${PUBLISHED_CASE_PATHS.length}`,
    );
  });

  it("tiene un solo h1 con texto Casos de clientes y mayúsculas por CSS", () => {
    const root = readDistPage("trabajo.html");
    const headings = root.querySelectorAll("h1");
    assert.equal(
      headings.length,
      1,
      `dist/trabajo.html tiene ${headings.length} h1; se exige uno`,
    );
    const h1 = headings[0];
    assert.ok(h1, "falta el h1 en dist/trabajo.html");
    const h1Text = h1.text.trim();
    assert.equal(
      h1Text,
      "Casos de clientes",
      `el h1 de dist/trabajo.html es «${h1Text}»; se exige «Casos de clientes»`,
    );
    assert.equal(
      h1Text,
      pageMeta.trabajo.heading,
      `el h1 («${h1Text}») no coincide con pageMeta.trabajo.heading («${pageMeta.trabajo.heading}»)`,
    );
    assert.notEqual(
      h1Text,
      "CASOS DE CLIENTES",
      "el h1 no puede ir en mayúsculas en el HTML; la apariencia va por CSS",
    );
    assert.notEqual(
      h1Text,
      "TRABAJO",
      "el h1 ya no es TRABAJO en el HTML; el menú sigue diciendo Trabajo",
    );
    const className = h1.getAttribute("class") ?? "";
    assert.ok(
      className.split(/\s+/).includes("work-index__title"),
      `el h1 tiene class="${className}"; se exige work-index__title`,
    );
    const styleBlocks = root.querySelectorAll("style").map((el) => el.text);
    assert.ok(
      styleBlocks.length > 0,
      "dist/trabajo.html no trae <style> para verificar text-transform",
    );
    const transformValue = ["up", "per", "case"].join("");
    const titleRule = new RegExp(
      String.raw`\.work-index__title[^{]*\{[^}]*text-transform\s*:\s*${transformValue}`,
      "i",
    );
    assert.ok(
      styleBlocks.some((css) => titleRule.test(css)),
      "ningún <style> de dist/trabajo.html define .work-index__title con text-transform en mayúsculas",
    );
  });

  it("fija title, description, og/twitter y JSON-LD de /trabajo", () => {
    const root = readDistPage("trabajo.html");
    const expectedTitle = pageMeta.trabajo.title;
    const expectedDescription = pageMeta.trabajo.description;
    assert.equal(expectedTitle.length, 53);
    assert.equal(expectedDescription.length, 153);

    const titles = root.querySelectorAll("title").map((node) => node.text.trim());
    assert.deepEqual(titles, [expectedTitle]);

    const descriptions = root.querySelectorAll("meta").flatMap((meta) => {
      if ((meta.getAttribute("name") ?? "").toLowerCase() !== "description") {
        return [];
      }
      return [meta.getAttribute("content")?.trim() ?? ""];
    });
    assert.deepEqual(descriptions, [expectedDescription]);

    const ogTitles = metaPropertyContents(root, "og:title");
    const ogDescriptions = metaPropertyContents(root, "og:description");
    const twitterTitles = metaNameContents(root, "twitter:title");
    const twitterDescriptions = metaNameContents(root, "twitter:description");
    assert.deepEqual(ogTitles, [expectedTitle]);
    assert.deepEqual(ogDescriptions, [expectedDescription]);
    assert.deepEqual(twitterTitles, [expectedTitle]);
    assert.deepEqual(twitterDescriptions, [expectedDescription]);

    const graphs = jsonLdGraphs(root);
    const collection = graphs.find(
      (node) => isRecord(node) && node["@type"] === "CollectionPage",
    );
    assert.ok(isRecord(collection), "falta CollectionPage en /trabajo");
    assert.equal(
      collection.name,
      "Casos de clientes",
      `CollectionPage.name=${JSON.stringify(collection.name)}; se exige Casos de clientes`,
    );
    assert.equal(collection.description, expectedDescription);

    const breadcrumb = graphs.find(
      (node) => isRecord(node) && node["@type"] === "BreadcrumbList",
    );
    assert.ok(isRecord(breadcrumb), "falta BreadcrumbList en /trabajo");
    assert.ok(Array.isArray(breadcrumb.itemListElement));
    const crumbNames = breadcrumb.itemListElement.map((item) => {
      assert.ok(isRecord(item));
      return String(item.name ?? "");
    });
    assert.deepEqual(crumbNames, ["Inicio", "Trabajo"]);
  });
});

function metaPropertyContents(document: HTMLElement, property: string): string[] {
  const needle = property.toLowerCase();
  return document.querySelectorAll("meta").flatMap((meta) => {
    if ((meta.getAttribute("property") ?? "").toLowerCase() !== needle) {
      return [];
    }
    return [meta.getAttribute("content")?.trim() ?? ""];
  });
}

function metaNameContents(document: HTMLElement, name: string): string[] {
  const needle = name.toLowerCase();
  return document.querySelectorAll("meta").flatMap((meta) => {
    if ((meta.getAttribute("name") ?? "").toLowerCase() !== needle) {
      return [];
    }
    return [meta.getAttribute("content")?.trim() ?? ""];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function jsonLdGraphs(document: HTMLElement): unknown[] {
  return document
    .querySelectorAll('script[type="application/ld+json"]')
    .flatMap((script) => {
      try {
        const parsed: unknown = JSON.parse(script.text);
        if (
          isRecord(parsed) &&
          "@graph" in parsed &&
          Array.isArray(parsed["@graph"])
        ) {
          return parsed["@graph"];
        }
        return [parsed];
      } catch {
        return [];
      }
    });
}
