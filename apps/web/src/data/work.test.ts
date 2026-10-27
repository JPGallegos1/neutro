import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pageMeta } from "./page-meta.ts";
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

  it("deja luxurycars fuera del tope de cuatro para Cargar más", () => {
    assert.ok(workProjects.length > LANDING_WORK_LIMIT);
    assert.deepEqual(
      workProjects.slice(0, LANDING_WORK_LIMIT).map((project) => project.id),
      LANDING_IDS,
    );
    assert.deepEqual(
      workProjects.slice(LANDING_WORK_LIMIT).map((project) => project.id),
      ["luxurycars"],
    );
  });

  it("expone los cinco hrefs /trabajo/<slug> sin query de página", () => {
    assert.deepEqual(
      workProjects.map((project) => project.href),
      PUBLISHED.map((project) => project.href),
    );
    for (const project of workProjects) {
      assert.ok(!project.href.includes("?"));
      assert.ok(!project.href.includes("page="));
    }
  });
});

describe("pageMeta.trabajo", () => {
  it("define title, description y canonical slashless sin query", () => {
    assert.equal(pageMeta.trabajo.path, "/trabajo");
    assert.equal(
      pageMeta.trabajo.title,
      "Casos y proyectos | Neutro Solutions",
    );
    assert.equal(
      pageMeta.trabajo.canonical,
      "https://neutro.solutions/trabajo",
    );
    assert.ok(!pageMeta.trabajo.canonical.includes("?"));
    assert.ok(!pageMeta.trabajo.canonical.includes("page="));
    assert.ok(pageMeta.trabajo.description.length > 80);
    assert.equal(pageMeta.trabajo.heading, "Trabajo");
  });
});
