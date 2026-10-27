import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getWorkCase,
  relatedWorkProjects,
  workCaseCanonical,
  workCaseDocumentTitle,
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
];

const EXPECTED_OUTCOME_TITLES = {
  "conexion-laboral": "agendar una asesoría gratuita con una sola página",
  afectiva: "un sitio propio para mostrar todo lo que hace la agencia",
  "capa-automotores": "un catálogo propio con panel para manejar el stock",
  "suplementacion-ciencia": "una tienda online que muestra la ciencia detrás",
  luxurycars:
    "una plataforma a medida para el mercado de autos de lujo en Suiza",
} as const;

describe("workCases", () => {
  it("expone los cinco casos con slug, meta y URL externa", () => {
    assert.deepEqual(
      workCases.map((item) => item.slug),
      EXPECTED_SLUGS,
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
      assert.equal(
        workCaseDocumentTitle(workCase),
        `${workCase.clientName}: ${workCase.outcomeTitle} | Neutro Solutions`,
      );
    }
  });

  it("alinea cada caso con un proyecto de la grilla", () => {
    for (const workCase of workCases) {
      const project = workProjects.find(
        (item) => item.id === workCase.projectId,
      );
      assert.ok(project, workCase.slug);
      assert.equal(project.slug, workCase.slug);
      assert.equal(project.href, workCasePath(workCase.slug));
      assert.equal(project.imageSrc, workCase.imageSrc);
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

  it("devuelve los otros casos en el orden fijo de workProjects", () => {
    const expectedBySlug = {
      "conexion-laboral": [
        "afectiva",
        "capa-automotores",
        "suplementacion-ciencia",
        "luxurycars",
      ],
      afectiva: [
        "conexion-laboral",
        "capa-automotores",
        "suplementacion-ciencia",
        "luxurycars",
      ],
      "capa-automotores": [
        "conexion-laboral",
        "afectiva",
        "suplementacion-ciencia",
        "luxurycars",
      ],
      "suplementacion-ciencia": [
        "conexion-laboral",
        "afectiva",
        "capa-automotores",
        "luxurycars",
      ],
      luxurycars: [
        "conexion-laboral",
        "afectiva",
        "capa-automotores",
        "suplementacion-ciencia",
      ],
    } as const;

    for (const workCase of workCases) {
      const related = relatedWorkProjects(workCase.slug);
      const slugs = related.map((project) => project.slug);
      assert.deepEqual(
        slugs,
        [...expectedBySlug[workCase.slug as keyof typeof expectedBySlug]],
        workCase.slug,
      );
      assert.equal(slugs.length, 4, workCase.slug);
      assert.equal(new Set(slugs).size, 4, workCase.slug);
      assert.ok(
        related.every((project) => project.slug !== workCase.slug),
        workCase.slug,
      );
    }

    assert.deepEqual(relatedWorkProjects("no-existe"), []);
  });
});

