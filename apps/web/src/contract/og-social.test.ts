import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parse, type HTMLElement } from "node-html-parser";

import { readDistHtmlPages } from "./dist.ts";

const SITE_NAME = "Neutro Solutions";

const REQUIRED_ROUTES = [
  "/",
  "/trabajo",
  "/trabajo/conexion-laboral",
  "/trabajo/afectiva",
  "/trabajo/capa-automotores",
  "/trabajo/suplementacion-ciencia",
  "/trabajo/luxurycars",
  "/nosotros",
  "/cookies",
  "/privacidad",
  "/terminos",
  "/alerta-estafa",
  "/404",
] as const;

function metaPropertyContents(
  document: HTMLElement,
  property: string,
): string[] {
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

function ogSocialProblems(document: HTMLElement, where: string): string[] {
  const problems: string[] = [];
  const siteNames = metaPropertyContents(document, "og:site_name");
  if (siteNames.length !== 1 || siteNames[0] !== SITE_NAME) {
    problems.push(
      `${where} og:site_name=${JSON.stringify(siteNames)}; se exige exactamente uno con ${JSON.stringify(SITE_NAME)}`,
    );
  }

  const ogTypes = metaPropertyContents(document, "og:type");
  if (ogTypes.length !== 1 || ogTypes[0] !== "website") {
    problems.push(
      `${where} og:type=${JSON.stringify(ogTypes)}; se exige exactamente uno con "website"`,
    );
  }

  const ogTitles = metaPropertyContents(document, "og:title");
  const twitterTitles = metaNameContents(document, "twitter:title");
  const ogTitle = ogTitles[0];
  const twitterTitle = twitterTitles[0];
  if (
    ogTitles.length !== 1 ||
    twitterTitles.length !== 1 ||
    ogTitle === undefined ||
    twitterTitle === undefined ||
    ogTitle === "" ||
    twitterTitle !== ogTitle
  ) {
    problems.push(
      `${where} twitter:title=${JSON.stringify(twitterTitles)} debe ser un solo valor igual a og:title=${JSON.stringify(ogTitles)}`,
    );
  }

  const ogDescriptions = metaPropertyContents(document, "og:description");
  const twitterDescriptions = metaNameContents(document, "twitter:description");
  const ogDescription = ogDescriptions[0];
  if (
    ogDescriptions.length === 1 &&
    ogDescription !== undefined &&
    ogDescription !== ""
  ) {
    const twitterDescription = twitterDescriptions[0];
    if (
      twitterDescriptions.length !== 1 ||
      twitterDescription === undefined ||
      twitterDescription !== ogDescription
    ) {
      problems.push(
        `${where} twitter:description=${JSON.stringify(twitterDescriptions)} debe ser un solo valor igual a og:description=${JSON.stringify(ogDescriptions)}`,
      );
    }
  } else if (twitterDescriptions.length > 0) {
    problems.push(
      `${where} twitter:description=${JSON.stringify(twitterDescriptions)} sin og:description usable`,
    );
  }

  return problems;
}

function validHeadHtml(): string {
  return [
    "<!doctype html><html><head>",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="Titulo de prueba" />`,
    `<meta property="og:description" content="Descripcion de prueba" />`,
    `<meta name="twitter:title" content="Titulo de prueba" />`,
    `<meta name="twitter:description" content="Descripcion de prueba" />`,
    "</head></html>",
  ].join("");
}

describe("contrato OG/Twitter (SEO-08)", () => {
  it("cubre home, /trabajo, fichas, /nosotros, legales y 404 en dist", () => {
    const routes = new Set(readDistHtmlPages().map((page) => page.route));
    const missing = REQUIRED_ROUTES.filter((route) => !routes.has(route));
    assert.deepEqual(
      missing,
      [],
      `faltan rutas en dist: ${missing.join(", ")}`,
    );
  });

  it("exige og:site_name, twitter:* alineado a og:* y og:type=website en cada HTML", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages()) {
      problems.push(
        ...ogSocialProblems(
          page.document,
          `dist/${page.relativePath} ruta ${page.route}`,
        ),
      );
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("falla al sacar og:site_name de una página", () => {
    const document = parse(
      validHeadHtml().replace(
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        "",
      ),
    );
    const problems = ogSocialProblems(document, "mutación sin og:site_name");
    assert.ok(
      problems.some((problem) => problem.includes("og:site_name")),
      problems.join("\n"),
    );
  });

  it("falla si twitter:title difiere de og:title", () => {
    const document = parse(
      validHeadHtml().replace(
        `<meta name="twitter:title" content="Titulo de prueba" />`,
        `<meta name="twitter:title" content="Otro titulo" />`,
      ),
    );
    const problems = ogSocialProblems(
      document,
      "mutación twitter:title distinto",
    );
    assert.ok(
      problems.some((problem) => problem.includes("twitter:title")),
      problems.join("\n"),
    );
  });

  it("falla al duplicar og:site_name", () => {
    const document = parse(
      validHeadHtml().replace(
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta property="og:site_name" content="${SITE_NAME}" /><meta property="og:site_name" content="${SITE_NAME}" />`,
      ),
    );
    const problems = ogSocialProblems(
      document,
      "mutación og:site_name duplicado",
    );
    assert.ok(
      problems.some((problem) => problem.includes("og:site_name")),
      problems.join("\n"),
    );
  });

  it("falla si og:site_name es Neutro a secas", () => {
    const document = parse(
      validHeadHtml().replace(`content="${SITE_NAME}"`, `content="Neutro"`),
    );
    const problems = ogSocialProblems(document, "mutación og:site_name Neutro");
    assert.ok(
      problems.some((problem) => problem.includes("og:site_name")),
      problems.join("\n"),
    );
  });
});
