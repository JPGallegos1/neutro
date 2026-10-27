import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BRAND_TITLE_SUFFIX,
  getWorkCase,
  MAX_DOCUMENT_TITLE_LENGTH,
  relatedWorkProjects,
  workCaseCanonical,
  workCaseDocumentTitle,
  workCaseHeadline,
  workCasePath,
  workCases,
} from "./work-cases.ts";
import { workProjects } from "./work.ts";

const EXPECTED_SLUGS = [
  "conexion-laboral",
  "afectiva",
  "capa-automotores",
  "suplementacion-ciencia",
  "luxurycars",
] as const;

const EXPECTED_OFFICIAL_NAMES = {
  "conexion-laboral": "Conexión Laboral",
  afectiva: "Afectiva Comunicaciones",
  "capa-automotores": "Capa Automotores",
  "suplementacion-ciencia": "Suplementación con Ciencia",
  luxurycars: "Luxury Cars",
} as const;

const EXPECTED_SEO_TITLES = {
  "conexion-laboral": "Conexión Laboral: landing de asesoría",
  afectiva: "Afectiva Comunicaciones: sitio web",
  "capa-automotores": "Capa Automotores: catálogo con stock",
  "suplementacion-ciencia": "Suplementación con Ciencia: tienda online",
  luxurycars: "Luxury Cars: plataforma de autos de lujo",
} as const;

const EXPECTED_OUTCOME_TITLES = {
  "conexion-laboral": "agendar una asesoría gratuita con una sola página",
  afectiva: "un sitio propio para mostrar todo lo que hace la agencia",
  "capa-automotores": "un catálogo propio con panel para manejar el stock",
  "suplementacion-ciencia": "una tienda online que muestra la ciencia detrás",
  luxurycars:
    "una plataforma a medida para el mercado de autos de lujo en Suiza",
} as const;

const FORBIDDEN_NAME_TOKENS = ["SCC", "LuxuryCars"] as const;

describe("workCases", () => {
  it("expone los cinco casos con slug, meta y URL externa", () => {
    assert.deepEqual(
      workCases.map((item) => item.slug),
      [...EXPECTED_SLUGS],
    );

    for (const workCase of workCases) {
      assert.ok(workCase.metaDescription.length >= 140, workCase.slug);
      assert.ok(workCase.metaDescription.length <= 155, workCase.slug);
      assert.match(workCase.externalUrl, /^https:\/\//);
      assert.equal(workCasePath(workCase.slug), `/trabajo/${workCase.slug}`);
      assert.equal(
        workCaseCanonical(workCase.slug),
        `https://neutro.solutions/trabajo/${workCase.slug}`,
      );
      assert.ok(!workCaseCanonical(workCase.slug).endsWith("/"));
      assert.equal(workCase.tag, "En producción");
      assert.notEqual(workCase.outcomeTitle, null);
      assert.equal(
        workCase.outcomeTitle,
        EXPECTED_OUTCOME_TITLES[
          workCase.slug as keyof typeof EXPECTED_OUTCOME_TITLES
        ],
      );
    }
  });

  it("usa un único nombre oficial en shortTitle, clientName y titleLines", () => {
    for (const workCase of workCases) {
      const official =
        EXPECTED_OFFICIAL_NAMES[
          workCase.slug as keyof typeof EXPECTED_OFFICIAL_NAMES
        ];
      assert.equal(workCase.clientName, official);
      assert.equal(workCase.shortTitle, official);
      assert.equal(workCase.titleLines.join(" "), official);
      for (const token of FORBIDDEN_NAME_TOKENS) {
        assert.notEqual(workCase.clientName, token, workCase.slug);
        assert.notEqual(workCase.shortTitle, token, workCase.slug);
        assert.ok(!workCase.titleLines.includes(token), workCase.slug);
      }
    }
  });

  it("fija seoTitle corto y document title ≤ 60 con sufijo de marca", () => {
    for (const workCase of workCases) {
      const seoTitle =
        EXPECTED_SEO_TITLES[workCase.slug as keyof typeof EXPECTED_SEO_TITLES];
      assert.equal(workCase.seoTitle, seoTitle);
      assert.equal(workCaseHeadline(workCase), seoTitle);
      const documentTitle = workCaseDocumentTitle(workCase);
      assert.equal(documentTitle, `${seoTitle}${BRAND_TITLE_SUFFIX}`);
      assert.ok(
        documentTitle.length <= MAX_DOCUMENT_TITLE_LENGTH,
        `${workCase.slug} title length ${documentTitle.length}`,
      );
      assert.ok(
        !documentTitle.includes(workCase.outcomeTitle ?? ""),
        workCase.slug,
      );
    }
  });

  it("alinea cada caso con un proyecto de la grilla y el mismo nombre", () => {
    for (const workCase of workCases) {
      const project = workProjects.find(
        (item) => item.id === workCase.projectId,
      );
      assert.ok(project, workCase.slug);
      assert.equal(project.slug, workCase.slug);
      assert.equal(project.href, workCasePath(workCase.slug));
      assert.equal(project.imageSrc, workCase.imageSrc);
      assert.equal(project.title, workCase.clientName);
      assert.equal(project.imageAlt, workCase.imageAlt);
      assert.ok(!project.imageAlt.includes("LuxuryCars"), workCase.slug);
    }
  });

  it("marca la cita de Luxury Cars en francés", () => {
    const luxury = getWorkCase("luxurycars");
    assert.ok(luxury);
    assert.equal(luxury.quote.lang, "fr");
    assert.equal(
      luxury.quote.text,
      "La plateforme suisse de référence pour les voitures de luxe.",
    );
  });

  it("devuelve todos los otros casos en el orden de workProjects", () => {
    assert.ok(workProjects.length >= 2);

    for (const project of workProjects) {
      const related = relatedWorkProjects(project.slug);
      const expected = workProjects.filter((item) => item.slug !== project.slug);
      assert.deepEqual(
        related.map((item) => item.slug),
        expected.map((item) => item.slug),
        project.slug,
      );
      assert.equal(related.length, workProjects.length - 1, project.slug);
      assert.equal(new Set(related.map((item) => item.slug)).size, related.length);
      assert.ok(related.every((item) => item.slug !== project.slug), project.slug);
    }

    assert.deepEqual(relatedWorkProjects("no-existe"), []);
  });

  it("con 6 casos simulados devuelve los 5 ajenos en el orden de la lista", () => {
    const base = workProjects[0];
    assert.ok(base);
    const six = [0, 1, 2, 3, 4, 5].map((index) => ({
      ...base,
      id: `simulado-${index}`,
      slug: `simulado-${index}`,
      title: `Simulado ${index}`,
      href: `/trabajo/simulado-${index}`,
    }));

    const current = six[2];
    assert.ok(current);
    const related = relatedWorkProjects(current.slug, six);
    const expected = six.filter((item) => item.slug !== current.slug);

    assert.equal(related.length, expected.length);
    assert.deepEqual(
      related.map((item) => item.slug),
      expected.map((item) => item.slug),
    );
    assert.ok(!related.some((item) => item.slug === current.slug));
    assert.equal(expected.length, six.length - 1);
    assert.notDeepEqual(
      related.map((item) => item.slug),
      expected.slice(0, 4).map((item) => item.slug),
    );
  });
});

