import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDistPage } from "./dist.ts";

const EXPECTED_RELATED: Record<string, string[]> = {
  "conexion-laboral": [
    "/trabajo/afectiva",
    "/trabajo/capa-automotores",
    "/trabajo/suplementacion-ciencia",
    "/trabajo/luxurycars",
  ],
  afectiva: [
    "/trabajo/conexion-laboral",
    "/trabajo/capa-automotores",
    "/trabajo/suplementacion-ciencia",
    "/trabajo/luxurycars",
  ],
  "capa-automotores": [
    "/trabajo/conexion-laboral",
    "/trabajo/afectiva",
    "/trabajo/suplementacion-ciencia",
    "/trabajo/luxurycars",
  ],
  "suplementacion-ciencia": [
    "/trabajo/conexion-laboral",
    "/trabajo/afectiva",
    "/trabajo/capa-automotores",
    "/trabajo/luxurycars",
  ],
  luxurycars: [
    "/trabajo/conexion-laboral",
    "/trabajo/afectiva",
    "/trabajo/capa-automotores",
    "/trabajo/suplementacion-ciencia",
  ],
};

function relatedHrefs(page: string): string[] {
  const root = readDistPage(page);
  const section = root.querySelector(".work-case__related");
  assert.ok(section, `${page}: falta .work-case__related`);
  return section
    .querySelectorAll("a.work-card__inner")
    .map((anchor) => anchor.getAttribute("href") ?? "");
}

describe("Más trabajo en fichas (SEO-06)", () => {
  it("lista los 4 casos ajenos en orden fijo de work.ts", () => {
    for (const [slug, expected] of Object.entries(EXPECTED_RELATED)) {
      const page = `trabajo/${slug}.html`;
      const hrefs = relatedHrefs(page);

      assert.equal(hrefs.length, 4, `${page}: se exigen 4 enlaces`);
      assert.deepEqual(hrefs, expected, page);
      assert.equal(new Set(hrefs).size, 4, `${page}: duplicados`);
      assert.ok(
        !hrefs.includes(`/trabajo/${slug}`),
        `${page}: no debe enlazarse a sí misma`,
      );
    }

    const luxuryFrom = Object.entries(EXPECTED_RELATED)
      .filter(([, hrefs]) => hrefs.includes("/trabajo/luxurycars"))
      .map(([slug]) => slug)
      .sort();
    assert.deepEqual(luxuryFrom, [
      "afectiva",
      "capa-automotores",
      "conexion-laboral",
      "suplementacion-ciencia",
    ]);
  });
});
