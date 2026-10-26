import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LANDING_WORK_LIMIT, workProjects } from "./work.ts";

const PUBLISHED = [
  {
    id: "conexlaboral",
    href: "https://conexlaboral.com",
  },
  {
    id: "afectiva",
    href: "https://afectiva.vercel.app",
  },
  {
    id: "capaautomotores",
    href: "https://capaautomotores.com",
  },
  {
    id: "suplementacionconciencia",
    href: "https://suplementacionconciencia.com.ar",
  },
  {
    id: "luxurycars",
    href: "https://luxurycars.ch",
  },
];

const LANDING_IDS = [
  "conexlaboral",
  "afectiva",
  "capaautomotores",
  "suplementacionconciencia",
];

describe("workProjects", () => {
  it("publica cinco sitios externos con ids únicos", () => {
    assert.equal(workProjects.length, 5);
    assert.deepEqual(
      workProjects.map((project) => project.id),
      PUBLISHED.map((project) => project.id),
    );
    assert.equal(new Set(workProjects.map((project) => project.id)).size, 5);

    for (const [index, project] of workProjects.entries()) {
      const published = PUBLISHED[index];
      assert.ok(published);
      const href = project.href;
      assert.equal(href, published.href);
      assert.ok(href);
      assert.match(href, /^https:\/\//);
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
