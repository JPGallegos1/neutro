import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  serviceCategories,
  serviceCopy,
  validateServiceCategories,
  type ServiceCategory,
} from "./services.ts";

const PUBLISHED_IDS = [
  "web",
  "diseno",
  "sistemas",
  "tienda-online",
  "automatizacion-ia",
];

function cloneCatalog(): ServiceCategory[] {
  return structuredClone(serviceCategories);
}

function categoryNamed(
  catalog: ServiceCategory[],
  id: string,
): ServiceCategory {
  const category = catalog.find((item) => item.id === id);
  assert.ok(category, id);
  return category;
}

describe("serviceCategories", () => {
  it("cada servicio tiene contenido", () => {
    assert.deepEqual(
      serviceCategories.map((category) => category.id),
      PUBLISHED_IDS,
    );
    assert.doesNotThrow(() => validateServiceCategories(serviceCategories));

    for (const category of serviceCategories) {
      assert.equal(
        serviceCopy(category.summary, category.id),
        category.summary,
      );
      if (category.body === "services") {
        assert.ok(category.services.length > 0, category.id);
        for (const service of category.services) {
          assert.equal(serviceCopy(service.label, category.id), service.label);
          assert.equal(
            serviceCopy(service.benefit, category.id),
            service.benefit,
          );
        }
      } else {
        assert.ok(category.tags.length > 0, category.id);
        for (const tag of category.tags) {
          assert.equal(serviceCopy(tag, category.id), tag);
        }
      }
    }
  });

  it("rechaza un resumen null", () => {
    const catalog = cloneCatalog();
    const diseno = categoryNamed(catalog, "diseno");
    (diseno as { summary: string | null }).summary = null;
    assert.throws(() => validateServiceCategories(catalog), /diseno\.summary/);
  });

  it("rechaza el texto null", () => {
    assert.throws(() => serviceCopy("null", "web.summary"), /web\.summary/);
    assert.throws(() => serviceCopy(" NULL ", "web.benefit"), /web\.benefit/);
    const catalog = cloneCatalog();
    const web = categoryNamed(catalog, "web");
    assert.equal(web.body, "services");
    if (web.body !== "services") return;
    const [first] = web.services;
    assert.ok(first);
    first.benefit = "null";
    assert.throws(
      () => validateServiceCategories(catalog),
      /web\.services\[0\]\.benefit/,
    );
  });

  it("rechaza una lista de servicios vacía", () => {
    const catalog = cloneCatalog();
    const sistemas = categoryNamed(catalog, "sistemas");
    assert.equal(sistemas.body, "services");
    if (sistemas.body !== "services") return;
    sistemas.services = [];
    assert.throws(
      () => validateServiceCategories(catalog),
      /sistemas\.services/,
    );
  });

  it("rechaza etiquetas vacías", () => {
    const catalog = cloneCatalog();
    const tienda = categoryNamed(catalog, "tienda-online");
    assert.equal(tienda.body, "tags");
    if (tienda.body !== "tags") return;
    tienda.tags = [];
    assert.throws(
      () => validateServiceCategories(catalog),
      /tienda-online\.tags/,
    );
  });
});
