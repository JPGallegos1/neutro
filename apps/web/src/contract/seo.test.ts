import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { HTMLElement } from "node-html-parser";

import {
  readDistHtmlPages,
  readDistSitemaps,
  routeFromDistHtml,
  type DistHtmlPage,
} from "./dist.ts";

const SITE = "https://neutro.solutions";
const pagesDir = fileURLToPath(new URL("../pages/", import.meta.url));
const PAGE_EXTENSIONS = [".astro", ".md", ".mdx", ".markdown"] as const;

type StaticSource = { file: string; route: string };
type DynamicSource = { file: string; pattern: RegExp };

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isHtmlPageFile(name: string): boolean {
  return PAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function stripPageExtension(name: string): string {
  const extension = PAGE_EXTENSIONS.find((item) => name.endsWith(item));
  return extension ? name.slice(0, -extension.length) : name;
}

function dynamicSegmentPattern(segment: string, file: string): string {
  if (
    segment.startsWith("[[...") &&
    segment.endsWith("]]") &&
    segment.length > "[[...]]".length
  ) {
    return "(?:/.*)?";
  }
  if (
    segment.startsWith("[...") &&
    segment.endsWith("]") &&
    segment.length > "[...]".length
  ) {
    return "/.+";
  }
  if (
    segment.startsWith("[[") &&
    segment.endsWith("]]") &&
    !segment.includes("...") &&
    segment.length > "[[]]".length
  ) {
    return "(?:/[^/]+)?";
  }
  if (
    segment.startsWith("[") &&
    segment.endsWith("]") &&
    !segment.startsWith("[[") &&
    !segment.includes("...") &&
    segment.length > "[]".length
  ) {
    return "/[^/]+";
  }
  throw new Error(
    `segmento dinámico no reconocido en src/pages/${file}: ${segment}`,
  );
}

function walkPages(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPages(path, files);
      continue;
    }
    if (entry.isFile() && isHtmlPageFile(entry.name)) {
      files.push(toPosix(relative(pagesDir, path)));
    }
  }
}

function readPageSources(): {
  staticSources: StaticSource[];
  dynamicSources: DynamicSource[];
} {
  const files: string[] = [];
  walkPages(pagesDir, files);
  const staticSources: StaticSource[] = [];
  const dynamicSources: DynamicSource[] = [];
  for (const file of files) {
    const segments = stripPageExtension(file)
      .split("/")
      .filter((segment) => segment !== "");
    if (segments[segments.length - 1] === "index") segments.pop();
    const dynamic = segments.some(
      (segment) => segment.startsWith("[") && segment.endsWith("]"),
    );
    if (!dynamic) {
      const route = segments.length === 0 ? "/" : `/${segments.join("/")}`;
      staticSources.push({ file, route });
      continue;
    }
    const pattern = segments
      .map((segment) =>
        segment.startsWith("[")
          ? dynamicSegmentPattern(segment, file)
          : `/${escapeRegExp(segment)}`,
      )
      .join("");
    dynamicSources.push({ file, pattern: new RegExp(`^${pattern}$`) });
  }
  return { staticSources, dynamicSources };
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

function isIndexable(page: DistHtmlPage): boolean {
  return page.route !== "/404" && !isNoindex(page.document);
}

function expectedCanonical(route: string): string {
  return route === "/" ? `${SITE}/` : `${SITE}${route}`;
}

function titleTexts(document: HTMLElement): string[] {
  return document.querySelectorAll("title").map((node) => node.text.trim());
}

function descriptionTexts(document: HTMLElement): string[] {
  return document.querySelectorAll("meta").flatMap((meta) => {
    if ((meta.getAttribute("name") ?? "").toLowerCase() !== "description") {
      return [];
    }
    return [meta.getAttribute("content")?.trim() ?? ""];
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

function pushGroup(
  groups: Map<string, string[]>,
  key: string,
  value: string,
): void {
  const current = groups.get(key);
  if (current) {
    current.push(value);
    return;
  }
  groups.set(key, [value]);
}

describe("contrato SEO del dist", () => {
  it("cruza cada HTML de dist con una página de src/pages", () => {
    const pages = readDistHtmlPages();
    const { staticSources, dynamicSources } = readPageSources();
    const problems: string[] = [];
    const staticByRoute = new Map<string, string[]>();
    const distByRoute = new Map<string, string[]>();

    for (const source of staticSources) {
      pushGroup(staticByRoute, source.route, source.file);
    }
    for (const [route, files] of staticByRoute) {
      if (files.length > 1) {
        problems.push(
          `src/pages duplica la ruta ${route}: ${files.map((file) => `src/pages/${file}`).join(", ")}`,
        );
      }
    }
    for (const page of pages) {
      pushGroup(distByRoute, page.route, page.relativePath);
    }
    for (const [route, files] of distByRoute) {
      if (files.length > 1) {
        problems.push(
          `dist duplica la ruta ${route}: ${files.map((file) => `dist/${file}`).join(", ")}`,
        );
      }
    }

    const matchedDynamic = new Set<string>();
    for (const page of pages) {
      const staticFiles = staticByRoute.get(page.route) ?? [];
      const dynamicFiles = dynamicSources.filter((source) =>
        source.pattern.test(page.route),
      );
      if (staticFiles.length + dynamicFiles.length !== 1) {
        problems.push(
          `dist/${page.relativePath} ruta ${page.route} coincide con ${staticFiles.length} páginas estáticas (${staticFiles.join(", ") || "ninguna"}) y ${dynamicFiles.length} dinámicas (${dynamicFiles.map((source) => source.file).join(", ") || "ninguna"})`,
        );
      }
      for (const source of dynamicFiles) matchedDynamic.add(source.file);
    }
    for (const source of staticSources) {
      if (!distByRoute.has(source.route)) {
        problems.push(
          `src/pages/${source.file} ruta ${source.route} no tiene HTML en dist`,
        );
      }
    }
    for (const source of dynamicSources) {
      if (!matchedDynamic.has(source.file)) {
        problems.push(`src/pages/${source.file} no genera ningún HTML en dist`);
      }
    }

    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("exige title y meta description no vacíos y únicos entre páginas indexables", () => {
    const indexable = readDistHtmlPages().filter(isIndexable);
    const problems: string[] = [];
    const titles = new Map<string, string[]>();
    const descriptions = new Map<string, string[]>();

    for (const page of indexable) {
      const where = `dist/${page.relativePath} ruta ${page.route}`;
      const titleValues = titleTexts(page.document);
      const descriptionValues = descriptionTexts(page.document);
      const title = titleValues[0];
      const description = descriptionValues[0];
      if (titleValues.length !== 1 || title === undefined || title === "") {
        problems.push(`${where} title=${JSON.stringify(titleValues)}`);
      } else {
        pushGroup(titles, title, page.route);
      }
      if (
        descriptionValues.length !== 1 ||
        description === undefined ||
        description === ""
      ) {
        problems.push(
          `${where} meta description=${JSON.stringify(descriptionValues)}`,
        );
      } else {
        pushGroup(descriptions, description, page.route);
      }
    }

    for (const [title, routes] of titles) {
      if (routes.length > 1) {
        problems.push(`title repetido «${title}» en ${routes.join(", ")}`);
      }
    }
    for (const [description, routes] of descriptions) {
      if (routes.length > 1) {
        problems.push(
          `meta description repetida «${description}» en ${routes.join(", ")}`,
        );
      }
    }

    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("exige canonical absoluto https://neutro.solutions más la ruta, sin barra final ni query", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages().filter(isIndexable)) {
      const hrefs = canonicalHrefs(page.document);
      const expected = expectedCanonical(page.route);
      const where = `dist/${page.relativePath} ruta ${page.route}`;
      const href = hrefs[0];
      if (hrefs.length !== 1 || href === undefined) {
        problems.push(
          `${where} tiene ${hrefs.length} canonical (${hrefs.join(", ")}); se exige ${expected}`,
        );
        continue;
      }
      let url: URL | undefined;
      try {
        url = new URL(href);
      } catch {
        url = undefined;
      }
      const pathname = url?.pathname;
      const slashless =
        pathname === "/" || (pathname !== undefined && !pathname.endsWith("/"));
      if (
        !url ||
        url.origin !== SITE ||
        url.search !== "" ||
        url.hash !== "" ||
        !slashless ||
        pathname !== page.route ||
        href !== expected
      ) {
        problems.push(
          `${where} canonical ${JSON.stringify(href)}; se exige ${expected} sin barra final ni query`,
        );
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("lista cada URL indexable exactamente una vez en el sitemap", () => {
    const indexable = readDistHtmlPages().filter(isIndexable);
    const sitemaps = readDistSitemaps();
    const problems: string[] = [];
    if (sitemaps.files.length === 0) {
      problems.push("dist no tiene archivos sitemap*.xml");
    }
    const expected = indexable
      .map((page) => expectedCanonical(page.route))
      .sort();
    const counts = new Map<string, string[]>();
    for (const entry of sitemaps.locs) {
      pushGroup(counts, entry.loc, entry.file);
    }
    for (const url of expected) {
      const hits = counts.get(url) ?? [];
      if (hits.length !== 1) {
        problems.push(
          `${url} aparece ${hits.length} veces en el sitemap (${hits.join(", ") || "ausente"})`,
        );
      }
    }
    for (const [loc, hits] of counts) {
      if (!expected.includes(loc)) {
        problems.push(
          `el sitemap lista ${JSON.stringify(loc)} en ${hits.join(", ")} y no es una página indexable`,
        );
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("deja /404 y las páginas noindex fuera del sitemap", () => {
    const pages = readDistHtmlPages();
    const locs = readDistSitemaps().locs;
    const problems: string[] = [];
    for (const page of pages) {
      if (isIndexable(page)) continue;
      const reasons = [
        page.route === "/404" ? "/404" : "",
        isNoindex(page.document) ? "noindex" : "",
      ].filter((reason) => reason !== "");
      const hits = locs.flatMap((entry) => {
        try {
          const route = routeFromDistHtml(new URL(entry.loc).pathname);
          return route === page.route ? [`${entry.loc} en ${entry.file}`] : [];
        } catch {
          return [];
        }
      });
      if (hits.length > 0) {
        problems.push(
          `dist/${page.relativePath} ruta ${page.route} (${reasons.join(" ")}) está en el sitemap: ${hits.join(", ")}`,
        );
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});
