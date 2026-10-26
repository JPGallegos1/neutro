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
      assert.equal(workCase.outcomeTitle, null);
      assert.match(
        workCaseDocumentTitle(workCase),
        new RegExp(`^${workCase.clientName} \\| Neutro Solutions$`),
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

  it("devuelve dos o tres casos relacionados distintos", () => {
    for (const workCase of workCases) {
      const related = relatedWorkProjects(workCase.slug, 3);
      assert.ok(related.length >= 2 && related.length <= 3, workCase.slug);
      assert.ok(
        related.every((project) => project.id !== workCase.projectId),
        workCase.slug,
      );
    }
  });
});
