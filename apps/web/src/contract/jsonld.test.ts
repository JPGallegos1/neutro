import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HTMLElement } from "node-html-parser";

import { readDistHtmlPages, type DistHtmlPage } from "./dist.ts";

const SITE = "https://neutro.solutions";
const ORGANIZATION_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;
const INDEX_ROUTE = "/trabajo";
const CASE_ROUTE = /^\/trabajo\/[a-z0-9-]+$/;
const BRAND = "Neutro Solutions";
const TITLE_MAX = 60;
const REF_KEYS = ["creator", "publisher", "isPartOf"] as const;
const DATE_KEYS = ["datePublished", "dateModified"] as const;

const INDEX_CRUMBS = [
  { position: 1, name: "Inicio", item: `${SITE}/` },
  { position: 2, name: "Trabajo", item: `${SITE}/trabajo` },
] as const;

const CASE_TITLES: Record<string, string> = {
  "/trabajo/conexion-laboral":
    "Conexión Laboral: landing de asesoría | Neutro Solutions",
  "/trabajo/afectiva":
    "Afectiva Comunicaciones: sitio web | Neutro Solutions",
  "/trabajo/capa-automotores":
    "Capa Automotores: catálogo con stock | Neutro Solutions",
  "/trabajo/suplementacion-ciencia":
    "Suplementación con Ciencia: tienda online | Neutro Solutions",
  "/trabajo/luxurycars":
    "Luxury Cars: plataforma de autos de lujo | Neutro Solutions",
};

type JsonRecord = Record<string, unknown>;

type ParsedBlock = {
  index: number;
  value: unknown;
};

type LoadedPage = {
  page: DistHtmlPage;
  nodes: JsonRecord[];
  blocks: ParsedBlock[];
  problems: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function where(page: DistHtmlPage): string {
  return `dist/${page.relativePath} ruta ${page.route}`;
}

function visibleText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function typesOf(node: JsonRecord): string[] {
  const value = node["@type"];
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function nodesOfType(nodes: JsonRecord[], type: string): JsonRecord[] {
  return nodes.filter((node) => typesOf(node).includes(type));
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function graphNodes(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(graphNodes);
  if (!isRecord(value)) return [];
  if ("@graph" in value) return graphNodes(value["@graph"]);
  return [value];
}

function ldJsonBlocks(document: HTMLElement): string[] {
  return document.querySelectorAll("script").flatMap((script) => {
    const type = (script.getAttribute("type") ?? "")
      .trim()
      .toLowerCase()
      .split(";")[0]
      ?.trim();
    if (type !== "application/ld+json") return [];
    return [script.text];
  });
}

function loadPages(): LoadedPage[] {
  return readDistHtmlPages().map((page) => {
    const problems: string[] = [];
    const nodes: JsonRecord[] = [];
    const blocks: ParsedBlock[] = [];
    ldJsonBlocks(page.document).forEach((raw, index) => {
      try {
        const value: unknown = JSON.parse(raw) as unknown;
        blocks.push({ index, value });
        nodes.push(...graphNodes(value));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        problems.push(
          `${where(page)} bloque ld+json #${index + 1} no es JSON: ${message}`,
        );
      }
    });
    return { page, nodes, blocks, problems };
  });
}

function definedIds(nodes: JsonRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    const id = node["@id"];
    if (typeof id === "string") ids.add(id);
  }
  return ids;
}

function referencedIds(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(referencedIds);
  if (isRecord(value) && typeof value["@id"] === "string") {
    return [value["@id"]];
  }
  return [];
}

function pathnameOf(value: string): string | undefined {
  try {
    const url = new URL(value, `${SITE}/`);
    if (url.origin !== SITE) return undefined;
    if (url.pathname === "/") return "/";
    return url.pathname.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function absoluteHttps(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}

function stringField(node: JsonRecord, key: string): string | undefined {
  const value = node[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function idRef(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const id = value["@id"];
  return typeof id === "string" ? id : undefined;
}

function itemUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  if (typeof value["@id"] === "string") return value["@id"];
  if (typeof value.url === "string") return value.url;
  return undefined;
}

function positionedName(
  node: JsonRecord,
  position: number,
): string | undefined {
  for (const item of asArray(node.itemListElement)) {
    if (!isRecord(item) || item.position !== position) continue;
    return typeof item.name === "string" ? item.name.trim() : undefined;
  }
  return undefined;
}

function metaContents(
  document: HTMLElement,
  key: "og:title" | "twitter:title",
): string[] {
  return document.querySelectorAll("meta").flatMap((meta) => {
    const name = (meta.getAttribute("name") ?? "").toLowerCase();
    const property = (meta.getAttribute("property") ?? "").toLowerCase();
    if (name !== key && property !== key) return [];
    return [meta.getAttribute("content")?.trim() ?? ""];
  });
}

function titleText(document: HTMLElement): string[] {
  return document.querySelectorAll("title").map((node) => node.text.trim());
}

function visitHrefs(document: HTMLElement): string[] {
  return document.querySelectorAll("a").flatMap((anchor) => {
    if (!visibleText(anchor.text).includes("Visitar sitio")) return [];
    const href = anchor.getAttribute("href");
    return href === undefined ? [] : [href];
  });
}

function cardNames(document: HTMLElement, route: string): string[] {
  return document.querySelectorAll("li.work-card").flatMap((card) => {
    const href = card.querySelector("a")?.getAttribute("href");
    if (href === undefined || pathnameOf(href) !== route) return [];
    const title = card.querySelector(".work-card__title");
    if (!title) return ["(sin .work-card__title)"];
    return [visibleText(title.text)];
  });
}

function itemListNames(nodes: JsonRecord[], route: string): string[] {
  const names: string[] = [];
  for (const list of nodesOfType(nodes, "ItemList")) {
    for (const item of asArray(list.itemListElement)) {
      if (!isRecord(item) || typeof item.url !== "string") continue;
      if (pathnameOf(item.url) !== route) continue;
      names.push(
        typeof item.name === "string" ? item.name.trim() : "(sin name)",
      );
    }
  }
  return names;
}

function singleValue(
  values: string[],
  label: string,
  problems: string[],
): string | undefined {
  if (values.length === 1) return values[0];
  problems.push(
    `${label}: se exige 1 y hay ${values.length} (${values.join(" | ") || "ninguno"})`,
  );
  return undefined;
}

function casePages(pages: LoadedPage[]): LoadedPage[] {
  return pages.filter((entry) => CASE_ROUTE.test(entry.page.route));
}

function indexPages(pages: LoadedPage[]): LoadedPage[] {
  return pages.filter((entry) => entry.page.route === INDEX_ROUTE);
}

function findDates(value: unknown, path: string, found: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findDates(item, `${path}[${index}]`, found);
    });
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`;
    if (DATE_KEYS.some((dateKey) => dateKey === key)) found.push(next);
    findDates(child, next, found);
  }
}

describe("contrato JSON-LD (SEO-15)", () => {
  it("parsea cada bloque ld+json como JSON", () => {
    const problems = loadPages().flatMap((entry) => entry.problems);
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("resuelve cada @id de creator, publisher e isPartOf en la misma página", () => {
    const problems: string[] = [];
    for (const entry of loadPages()) {
      problems.push(...entry.problems);
      const ids = definedIds(entry.nodes);
      for (const node of entry.nodes) {
        const caseCreative =
          CASE_ROUTE.test(entry.page.route) &&
          typesOf(node).includes("CreativeWork");
        for (const key of REF_KEYS) {
          if (!(key in node)) {
            if (!caseCreative) continue;
            problems.push(
              `${where(entry.page)} CreativeWork no tiene ${key}`,
            );
            continue;
          }
          const refs = referencedIds(node[key]);
          if (refs.length === 0) {
            const type = typesOf(node)[0] ?? "(sin @type)";
            problems.push(
              `${where(entry.page)} ${type}.${key} no tiene @id`,
            );
            continue;
          }
          for (const id of refs) {
            const type = typesOf(node)[0] ?? "(sin @type)";
            if (!ids.has(id)) {
              problems.push(
                `${where(entry.page)} ${type}.${key} apunta a ${JSON.stringify(id)} y ese @id no está en el grafo de la página`,
              );
              continue;
            }
            if (!caseCreative) continue;
            if (key === "creator" || key === "publisher") {
              const organization = entry.nodes.some(
                (item) =>
                  item["@id"] === id &&
                  typesOf(item).includes("Organization"),
              );
              if (id === ORGANIZATION_ID && organization) continue;
              problems.push(
                `${where(entry.page)} CreativeWork.${key} apunta a ${JSON.stringify(id)}; se exige la Organization ${ORGANIZATION_ID} de la misma página`,
              );
              continue;
            }
            const website = entry.nodes.some(
              (item) =>
                item["@id"] === id && typesOf(item).includes("WebSite"),
            );
            if (id === WEBSITE_ID && website) continue;
            problems.push(
              `${where(entry.page)} CreativeWork.isPartOf apunta a ${JSON.stringify(id)}; se exige el WebSite ${WEBSITE_ID} de la misma página`,
            );
          }
        }
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("alinea el CreativeWork de cada ficha con H1, tarjeta, ItemList y breadcrumb", () => {
    const pages = loadPages();
    const problems: string[] = [];
    const cases = casePages(pages);
    if (cases.length === 0) {
      problems.push("dist no tiene fichas /trabajo/<slug>");
    }
    const indexes = indexPages(pages);
    singleValue(
      indexes.map((entry) => entry.page.relativePath),
      "dist /trabajo",
      problems,
    );
    const indexEntry = indexes.length === 1 ? indexes[0] : undefined;

    for (const entry of cases) {
      problems.push(...entry.problems);
      const label = where(entry.page);
      const works = nodesOfType(entry.nodes, "CreativeWork");
      const work = singleValue(
        works.map((node) => stringField(node, "@id") ?? "(sin @id)"),
        `${label} CreativeWork`,
        problems,
      );
      const creative = works.length === 1 ? works[0] : undefined;
      if (work === undefined || creative === undefined) continue;

      const organization = entry.nodes.some(
        (node) =>
          node["@id"] === ORGANIZATION_ID &&
          typesOf(node).includes("Organization"),
      );
      if (!organization) {
        problems.push(
          `${label} no tiene la Organization ${ORGANIZATION_ID} en el grafo`,
        );
      }
      const creatorId = idRef(creative.creator);
      if (creatorId !== ORGANIZATION_ID) {
        problems.push(
          `${label} creator.@id=${JSON.stringify(creatorId ?? null)}; se exige ${ORGANIZATION_ID}`,
        );
      }

      const visits = visitHrefs(entry.page.document);
      const visit = singleValue(
        visits,
        `${label} enlace «Visitar sitio»`,
        problems,
      );
      const about = creative.about;
      const aboutUrl =
        isRecord(about) && typeof about.url === "string"
          ? about.url
          : undefined;
      if (
        aboutUrl === undefined ||
        !absoluteHttps(aboutUrl) ||
        visit === undefined ||
        aboutUrl !== visit
      ) {
        problems.push(
          `${label} about.url=${JSON.stringify(aboutUrl ?? null)}; se exige el href https absoluto de «Visitar sitio» (${JSON.stringify(visit ?? null)})`,
        );
      }

      const titles = titleText(entry.page.document);
      const title = titles.length === 1 ? titles[0] : undefined;
      const headline = stringField(creative, "headline");
      if (headline === undefined || headline.includes(BRAND)) {
        problems.push(
          `${label} headline=${JSON.stringify(headline ?? null)}; no puede incluir «${BRAND}»`,
        );
      }
      if (
        headline !== undefined &&
        title !== undefined &&
        [...headline].length > [...title].length
      ) {
        problems.push(
          `${label} headline tiene ${[...headline].length} caracteres y el title ${[...title].length}; el headline no puede ser más largo`,
        );
      }

      const h1s = entry.page.document
        .querySelectorAll("h1")
        .map((node) => visibleText(node.text));
      const h1 = singleValue(h1s, `${label} h1`, problems);
      const crumbs = nodesOfType(entry.nodes, "BreadcrumbList");
      const crumbList = crumbs.length === 1 ? crumbs[0] : undefined;
      if (crumbs.length !== 1 || crumbList === undefined) {
        problems.push(
          `${label} BreadcrumbList: se exige 1 y hay ${crumbs.length}`,
        );
      }
      const crumbName =
        crumbList === undefined ? undefined : positionedName(crumbList, 3);
      const cards =
        indexEntry === undefined
          ? []
          : cardNames(indexEntry.page.document, entry.page.route);
      const card = singleValue(cards, `${label} tarjeta en /trabajo`, problems);
      const listed =
        indexEntry === undefined
          ? []
          : itemListNames(indexEntry.nodes, entry.page.route);
      const listedName = singleValue(
        listed,
        `${label} ItemList de /trabajo`,
        problems,
      );
      const name = stringField(creative, "name");
      const surfaces: Array<[string, string | undefined]> = [
        ["CreativeWork.name", name],
        ["h1", h1],
        ["tarjeta", card],
        ["ItemList", listedName],
        ["breadcrumb[3]", crumbName],
      ];
      const present = surfaces.flatMap(([, value]) =>
        value === undefined ? [] : [value],
      );
      const aligned =
        new Set(present).size === 1 && present.length === surfaces.length;
      if (!aligned) {
        problems.push(
          `${label} ${surfaces
            .map(([key, value]) => `${key}=${JSON.stringify(value ?? null)}`)
            .join(" ")}`,
        );
      }
    }

    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("exige en /trabajo un BreadcrumbList de Inicio y Trabajo", () => {
    const problems: string[] = [];
    const indexes = indexPages(loadPages());
    const index = indexes.length === 1 ? indexes[0] : undefined;
    if (index === undefined) {
      problems.push(
        `dist tiene ${indexes.length} páginas /trabajo; se exige 1`,
      );
    } else {
      problems.push(...index.problems);
      const lists = nodesOfType(index.nodes, "BreadcrumbList");
      if (lists.length !== 1) {
        problems.push(
          `${where(index.page)} BreadcrumbList: se exige 1 y hay ${lists.length}`,
        );
      }
      const list = lists.length === 1 ? lists[0] : undefined;
      if (list !== undefined) {
        const items = asArray(list.itemListElement);
        if (items.length !== INDEX_CRUMBS.length) {
          problems.push(
            `${where(index.page)} BreadcrumbList tiene ${items.length} ítems; se exigen ${INDEX_CRUMBS.length}`,
          );
        }
        for (const expected of INDEX_CRUMBS) {
          const item = items.find(
            (entry) => isRecord(entry) && entry.position === expected.position,
          );
          const name = isRecord(item) ? stringField(item, "name") : undefined;
          const url = isRecord(item) ? itemUrl(item.item) : undefined;
          if (name === expected.name && url === expected.item) continue;
          problems.push(
            `${where(index.page)} breadcrumb posición ${expected.position}: name=${JSON.stringify(name ?? null)} item=${JSON.stringify(url ?? null)}; se exige name=${JSON.stringify(expected.name)} item=${JSON.stringify(expected.item)}`,
          );
        }
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("no publica datePublished ni dateModified en ningún nodo", () => {
    const problems: string[] = [];
    for (const entry of loadPages()) {
      for (const block of entry.blocks) {
        const found: string[] = [];
        findDates(block.value, `bloque #${block.index + 1}`, found);
        for (const path of found) {
          problems.push(`${where(entry.page)} ${path}`);
        }
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("limita el title de cada ficha a 60, lo iguala en og:title y, si existe, en twitter:title", () => {
    const problems: string[] = [];
    const cases = casePages(loadPages());
    if (cases.length === 0) {
      problems.push("dist no tiene fichas /trabajo/<slug>");
    }
    for (const entry of cases) {
      const label = where(entry.page);
      const titles = titleText(entry.page.document);
      const title = singleValue(titles, `${label} <title>`, problems);
      const expected = CASE_TITLES[entry.page.route];
      if (expected === undefined) {
        problems.push(
          `${label} no tiene título SEO fijado; las fichas de work.ts tienen que estar en el contrato`,
        );
      } else if ([...expected].length > TITLE_MAX) {
        problems.push(
          `${label} el título SEO fijado tiene ${[...expected].length} caracteres; máximo ${TITLE_MAX} con la marca`,
        );
      } else if (title !== undefined && title !== expected) {
        problems.push(
          `${label} <title>=${JSON.stringify(title)}; se exige ${JSON.stringify(expected)}`,
        );
      }
      if (title !== undefined && [...title].length > TITLE_MAX) {
        problems.push(
          `${label} <title> tiene ${[...title].length} caracteres (${JSON.stringify(title)}); máximo ${TITLE_MAX} con la marca`,
        );
      }
      const og = metaContents(entry.page.document, "og:title");
      const twitter = metaContents(entry.page.document, "twitter:title");
      const ogTitle = singleValue(og, `${label} og:title`, problems);
      if (
        title === undefined ||
        ogTitle === undefined ||
        ogTitle !== title
      ) {
        problems.push(
          `${label} title=${JSON.stringify(title ?? null)} og:title=${JSON.stringify(ogTitle ?? null)}; tienen que ser el mismo texto`,
        );
      }
      if (twitter.length === 0) continue;
      const twitterTitle = singleValue(
        twitter,
        `${label} twitter:title`,
        problems,
      );
      if (
        title === undefined ||
        twitterTitle === undefined ||
        twitterTitle !== title
      ) {
        problems.push(
          `${label} twitter:title=${JSON.stringify(twitterTitle ?? null)}; se exige igual a <title> ${JSON.stringify(title ?? null)}`,
        );
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});
