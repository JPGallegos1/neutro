import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, type HTMLElement } from "node-html-parser";

import { pageMeta } from "../data/page-meta.ts";
import { workProjects } from "../data/work.ts";

const SITE = "https://neutro.solutions";
const INDEX_CANONICAL = "https://neutro.solutions/trabajo";
const PUBLISHED_CASE_LINKS = 5;
const LANDING_CARDS = 4;
const HIDE_CLASSES = ["is-collapsed", "is-enhanced"] as const;

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function readDistPage(filename: string): HTMLElement {
  const path = join(distDir, filename);
  try {
    return parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(
        `falta ${path}. El contrato lee el HTML de astro build (build.format: file).`,
      );
    }
    throw error;
  }
}

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

function declaresDisplayNone(style: string): boolean {
  return style.split(";").some((declaration) => {
    const colon = declaration.indexOf(":");
    if (colon === -1) return false;
    const prop = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration
      .slice(colon + 1)
      .trim()
      .toLowerCase()
      .replace(/\s*!important\s*$/, "");
    return prop === "display" && value === "none";
  });
}

describe("dist/trabajo.html", () => {
  it("incluye exactamente los 5 links /trabajo/<slug> de workProjects", () => {
    const found = casePaths(readDistPage("trabajo.html"));
    const expected = workProjects.map((project) => project.href);
    assert.equal(
      found.length,
      PUBLISHED_CASE_LINKS,
      `dist/trabajo.html tiene ${found.length} links a /trabajo/<slug> (${found.join(", ")}); se exigen ${PUBLISHED_CASE_LINKS}, los de workProjects (${expected.join(", ")})`,
    );
    assert.deepEqual(
      found,
      expected,
      `los links /trabajo/<slug> de dist/trabajo.html (${found.join(", ")}) no siguen workProjects (${expected.join(", ")})`,
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
          `dist/trabajo.html trae la clase ${name} en <${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">; sin JS esa clase no puede estar en el markup`,
        );
      }
    }

    for (const card of root.querySelectorAll("li.work-card")) {
      const nodes = [card, ...card.querySelectorAll("*")];
      for (const node of nodes) {
        assert.ok(
          !node.hasAttribute("hidden"),
          `una card de dist/trabajo.html (o un hijo) tiene hidden: <${node.tagName.toLowerCase()} class="${node.getAttribute("class") ?? ""}">`,
        );
        const style = node.getAttribute("style") ?? "";
        assert.ok(
          !declaresDisplayNone(style),
          `una card de dist/trabajo.html tiene display:none inline: <${node.tagName.toLowerCase()} style="${style}">`,
        );
      }
    }

    const buttons = root
      .querySelectorAll("button")
      .filter((el) => el.text.trim() === "Cargar más");
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
    const landingHrefs = workProjects
      .slice(0, LANDING_CARDS)
      .map((project) => project.href);
    assert.equal(
      homeCards.length,
      LANDING_CARDS,
      `dist/index.html tiene ${homeCards.length} cards; la home muestra ${LANDING_CARDS}`,
    );
    assert.deepEqual(
      homeHrefs,
      landingHrefs,
      `las cards de dist/index.html (${homeHrefs.join(", ")}) no son las primeras ${LANDING_CARDS} de workProjects (${landingHrefs.join(", ")})`,
    );
    assert.equal(
      trabajoCards.length,
      PUBLISHED_CASE_LINKS,
      `dist/trabajo.html tiene ${trabajoCards.length} cards; /trabajo muestra ${PUBLISHED_CASE_LINKS}`,
    );
  });
});
