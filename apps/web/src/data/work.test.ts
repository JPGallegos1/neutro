import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LANDING_WORK_LIMIT, workProjects } from "./work.ts";

const PUBLISHED = [
  {
    id: "conexlaboral",
    slug: "conexion-laboral",
    href: "/trabajo/conexion-laboral",
  },
  {
    id: "afectiva",
    slug: "afectiva",
    href: "/trabajo/afectiva",
  },
  {
    id: "capaautomotores",
    slug: "capa-automotores",
    href: "/trabajo/capa-automotores",
  },
  {
    id: "suplementacionconciencia",
    slug: "suplementacion-ciencia",
    href: "/trabajo/suplementacion-ciencia",
  },
  {
    id: "luxurycars",
    slug: "luxurycars",
    href: "/trabajo/luxurycars",
  },
];

const LANDING_IDS = [
  "conexlaboral",
  "afectiva",
  "capaautomotores",
  "suplementacionconciencia",
];

describe("workProjects", () => {
  it("publica cinco casos con slugs slashless e ids únicos", () => {
    assert.equal(workProjects.length, 5);
    assert.deepEqual(
      workProjects.map((project) => project.id),
      PUBLISHED.map((project) => project.id),
    );
    assert.equal(new Set(workProjects.map((project) => project.id)).size, 5);
    assert.equal(new Set(workProjects.map((project) => project.slug)).size, 5);

    for (const [index, project] of workProjects.entries()) {
      const published = PUBLISHED[index];
      assert.ok(published);
      assert.equal(project.slug, published.slug);
      assert.equal(project.href, published.href);
      assert.match(project.href, /^\/trabajo\/[a-z0-9-]+$/);
      assert.ok(!project.href.endsWith("/"));
      assert.equal(project.tag, "En producción");
    }
  });

  it("limita la landing a las primeras cuatro en orden", () => {
    assert.equal(LANDING_WORK_LIMIT, 4);
    assert.deepEqual(
      workProjects.slice(0, LANDING_WORK_LIMIT).map((project) => project.id),
      LANDING_IDS,
    );
  });
});
