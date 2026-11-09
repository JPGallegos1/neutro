import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { HTMLElement } from "node-html-parser";

import {
  WEB_SITIO_PRESUPUESTO_LINE,
  WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE,
  servicePages,
} from "../data/service-pages.ts";
import { readDistPage, readDistSitemaps } from "./dist.ts";

const SITE = "https://neutro.solutions";
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

function visibleText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function jsonLdNodes(document: HTMLElement): Record<string, unknown>[] {
  return document
    .querySelectorAll('script[type="application/ld+json"]')
    .flatMap((script) => {
      try {
        const parsed = JSON.parse(script.text) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is Record<string, unknown> =>
              typeof item === "object" && item !== null && !Array.isArray(item),
          );
        }
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          const record = parsed as Record<string, unknown>;
          const graph = record["@graph"];
          if (Array.isArray(graph)) {
            return graph.filter(
              (item): item is Record<string, unknown> =>
                typeof item === "object" &&
                item !== null &&
                !Array.isArray(item),
            );
          }
          return [record];
        }
      } catch {
        return [];
      }
      return [];
    });
}

function distHtml(filename: string): string {
  return readFileSync(join(distDir, filename), "utf8");
}

function pageCss(relativePath: string): string {
  const html = distHtml(relativePath);
  const blocks: string[] = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push(match[1] ?? "");
  }
  const hrefs = [
    ...html.matchAll(
      /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi,
    ),
  ].map((match) => match[1] ?? "");
  for (const href of hrefs) {
    const path = href.startsWith("/")
      ? join(distDir, href.slice(1))
      : join(distDir, href);
    blocks.push(readFileSync(path, "utf8"));
  }
  return blocks.join("\n");
}

describe("dist service pages", () => {
  it("incluye /web y /automatizacion-ia en el sitemap una vez", () => {
    const sitemaps = readDistSitemaps();
    for (const path of ["/web", "/automatizacion-ia"] as const) {
      const expected = `${SITE}${path}`;
      const hits = sitemaps.locs.filter((entry) => entry.loc === expected);
      assert.equal(
        hits.length,
        1,
        `${expected} aparece ${hits.length} veces en el sitemap`,
      );
    }
  });

  it("excluye del HTML de /web las dos frases Confirmar no aprobadas", () => {
    const html = distHtml("web.html");
    assert.equal(
      html.includes(WEB_SITIO_PRESUPUESTO_LINE),
      false,
      `dist/web.html no debe incluir ${JSON.stringify(WEB_SITIO_PRESUPUESTO_LINE)}`,
    );
    assert.equal(
      html.includes(WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE),
      false,
      `dist/web.html no debe incluir ${JSON.stringify(WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE)}`,
    );
  });

  for (const [filename, pageCopy] of [
    ["web.html", servicePages.web],
    ["automatizacion-ia.html", servicePages.automatizacionIa],
  ] as const) {
    it(`${pageCopy.path}: H1 único, H2 de sección, canonical y sin FAQ`, () => {
      const root = readDistPage(filename);
      const h1 = root.querySelectorAll("h1");
      assert.equal(h1.length, 1, `${pageCopy.path} debe tener un solo H1`);
      assert.equal(visibleText(h1[0]?.text ?? ""), pageCopy.heading);

      const h2 = root
        .querySelectorAll("h2")
        .map((el) => visibleText(el.text))
        .filter((text) => text.length > 0 && text !== "Contacto");
      for (const block of pageCopy.blocks) {
        assert.ok(
          h2.includes(block.title),
          `${pageCopy.path} falta H2 ${block.title}`,
        );
      }
      assert.ok(
        h2.includes("También te puede servir"),
        `${pageCopy.path} falta H2 También te puede servir`,
      );
      assert.equal(h2.includes("Cómo trabajamos"), false);
      assert.equal(h2.includes("Preguntas frecuentes"), false);
      if (pageCopy.casesTitle) {
        assert.ok(h2.includes(pageCopy.casesTitle));
      } else {
        assert.equal(h2.includes("Casos relacionados"), false);
      }

      const canonicals = canonicalHrefs(root);
      assert.deepEqual(canonicals, [`${SITE}${pageCopy.path}`]);

      const title = root.querySelector("title")?.text.trim();
      assert.equal(title, pageCopy.title);
      const description = root
        .querySelectorAll("meta")
        .find((meta) => meta.getAttribute("name") === "description")
        ?.getAttribute("content");
      assert.equal(description, pageCopy.description);

      const nodes = jsonLdNodes(root);
      const types = nodes.flatMap((node) => {
        const value = node["@type"];
        return typeof value === "string" ? [value] : [];
      });
      assert.ok(types.includes("Service"), `${pageCopy.path} sin Service`);
      assert.ok(
        types.includes("BreadcrumbList"),
        `${pageCopy.path} sin BreadcrumbList`,
      );
      assert.equal(types.includes("FAQPage"), false);
    });
  }

  it("/web enlaza casos relativos y /automatizacion-ia; CTAs monocromos", () => {
    const root = readDistPage("web.html");
    const css = pageCss("web.html");
    const caseHrefs = root
      .querySelectorAll("a.service-tile")
      .map((el) => el.getAttribute("href") ?? "");
    assert.deepEqual(caseHrefs, [
      "/trabajo/afectiva",
      "/trabajo/capa-automotores",
      "/trabajo/suplementacion-ciencia",
      "/trabajo/conexion-laboral",
      "/trabajo/luxurycars",
    ]);
    for (const href of caseHrefs) {
      assert.match(href, /^\/trabajo\//);
      assert.equal(href.startsWith("http"), false);
    }

    const related = root
      .querySelectorAll("a.service-rel__link")
      .map((el) => el.getAttribute("href") ?? "");
    assert.deepEqual(related, ["/automatizacion-ia"]);

    const ctas = root.querySelectorAll("a.service-cta");
    assert.ok(ctas.length >= 2);
    for (const cta of ctas) {
      assert.equal(cta.getAttribute("href"), "/contacto?origen=/web");
      assert.equal(cta.getAttribute("data-origen"), "/web");
      assert.equal(cta.getAttribute("data-cta"), "contacto");
    }

    assert.match(css, /\.service-cta[^{]*\{[^}]*background:\s*#0a0a0a/i);
    assert.match(css, /\.service-cta[^{]*\{[^}]*color:\s*#fff(?:fff)?\b/i);
    assert.match(
      css,
      /\.service-cta[^{]*:hover[^{]*\{[^}]*background:\s*#262624/i,
    );
    assert.match(
      css,
      /\.service-cta[^{]*:focus-visible[^{]*\{[^}]*outline:\s*2px\s+solid\s+#0a0a0a/i,
    );
    assert.match(
      css,
      /\.service-cta--on-dark[^{]*\{[^}]*background:\s*#fff(?:fff)?\b/i,
    );
  });

  it("/automatizacion-ia enlaza a /web y no lista casos", () => {
    const root = readDistPage("automatizacion-ia.html");
    assert.equal(root.querySelectorAll("a.service-tile").length, 0);
    assert.equal(root.querySelector("#casos"), null);
    const related = root
      .querySelectorAll("a.service-rel__link")
      .map((el) => el.getAttribute("href") ?? "");
    assert.deepEqual(related, ["/web"]);
    const ctas = root.querySelectorAll("a.service-cta");
    for (const cta of ctas) {
      assert.equal(
        cta.getAttribute("href"),
        "/contacto?origen=/automatizacion-ia",
      );
    }
  });

  it("/contacto canónica a /contacto y el sitemap no lista ?origen=", () => {
    const contacto = readDistPage("contacto.html");
    const canonicals = canonicalHrefs(contacto);
    assert.deepEqual(canonicals, [`${SITE}/contacto`]);
    const sitemaps = readDistSitemaps();
    assert.equal(
      sitemaps.locs.some((entry) => entry.loc.includes("?origen=")),
      false,
    );
  });
});
