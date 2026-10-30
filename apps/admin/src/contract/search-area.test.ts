import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createMemorySearchAreaRepository } from "@/memory-search-area-repository";
import {
  SEARCH_AREA_RADIUS_MAX_KM,
  SEARCH_AREA_RADIUS_MIN_KM,
  createRosarioDefaultArea,
  createRosarioDefaultDraft,
  createSearchArea,
  draftToCreateInput,
} from "@/search-area";

describe("Área de búsqueda — dominio", () => {
  it("default operativo es Rosario centro · 3 km", () => {
    const draft = createRosarioDefaultDraft();
    assert.equal(draft.name, "Rosario centro · 3 km");
    assert.equal(draft.radiusKm, "3");
    assert.equal(draft.shape, "circle");
    assert.equal(Number(draft.centerLat), -32.9442);
    assert.equal(Number(draft.centerLng), -60.6505);
    const area = createRosarioDefaultArea("2026-10-30T00:00:00.000Z");
    assert.equal(area.radiusKm, 3);
    assert.equal(area.shape, "circle");
  });

  it("rechaza radio fuera de 0.5–10 km", () => {
    const low = createSearchArea({
      name: "Muy chica",
      center: { lat: -32.94, lng: -60.65 },
      radiusKm: SEARCH_AREA_RADIUS_MIN_KM - 0.1,
      shape: "circle",
    });
    assert.equal(low.ok, false);
    if (!low.ok) assert.equal(low.error, "radius_out_of_bounds");

    const high = createSearchArea({
      name: "Muy grande",
      center: { lat: -32.94, lng: -60.65 },
      radiusKm: SEARCH_AREA_RADIUS_MAX_KM + 0.1,
      shape: "circle",
    });
    assert.equal(high.ok, false);
    if (!high.ok) assert.equal(high.error, "radius_out_of_bounds");

    const ok = createSearchArea({
      name: "Ok",
      center: { lat: -32.94, lng: -60.65 },
      radiusKm: 3,
      shape: "circle",
      id: "area_test",
      now: "2026-10-30T00:00:00.000Z",
    });
    assert.equal(ok.ok, true);
  });

  it("exige polígono válido cuando shape es polygon", () => {
    const missing = createSearchArea({
      name: "Poly",
      center: { lat: -32.94, lng: -60.65 },
      radiusKm: 2,
      shape: "polygon",
      polygon: null,
    });
    assert.equal(missing.ok, false);

    const draft = createRosarioDefaultDraft();
    draft.shape = "polygon";
    draft.polygonText = JSON.stringify([
      { lat: -32.94, lng: -60.65 },
      { lat: -32.95, lng: -60.65 },
      { lat: -32.95, lng: -60.66 },
    ]);
    const input = draftToCreateInput(draft);
    assert.equal(input.ok, true);
  });
});

describe("Área de búsqueda — persistencia (memory repo)", () => {
  it("lista el default Rosario y permite crear/reutilizar otra área", async () => {
    const repo = createMemorySearchAreaRepository({
      now: "2026-10-30T00:00:00.000Z",
    });
    const initial = await repo.list();
    assert.equal(initial.length, 1);
    assert.equal(initial[0]?.name, "Rosario centro · 3 km");
    assert.equal(initial[0]?.radiusKm, 3);

    const created = await repo.create({
      name: "Fisherton · 2 km",
      center: { lat: -32.91, lng: -60.72 },
      radiusKm: 2,
      shape: "circle",
      id: "area_fisherton",
      now: "2026-10-30T01:00:00.000Z",
    });
    assert.equal(created.id, "area_fisherton");

    const listed = await repo.list();
    assert.equal(listed.length, 2);
    assert.equal(listed[1]?.name, "Fisherton · 2 km");

    const reused = await repo.getById("area_rosario_centro_3km");
    assert.ok(reused);
    assert.equal(reused?.name, "Rosario centro · 3 km");
  });

  it("elige seed Rosario opcionalmente apagado", async () => {
    const repo = createMemorySearchAreaRepository({ seedRosario: false });
    assert.deepEqual(await repo.list(), []);
  });
});
