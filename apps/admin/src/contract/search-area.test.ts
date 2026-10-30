import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import {
  createD1SearchAreaRepository,
  type D1DatabaseLike,
  type D1PreparedStatement,
} from "@/d1-search-area-repository";
import {
  SEARCH_AREA_RADIUS_MAX_KM,
  SEARCH_AREA_RADIUS_MIN_KM,
  createMemorySearchAreaRepository,
  createRosarioDefaultArea,
  createRosarioDefaultDraft,
  createSearchArea,
  draftToCreateInput,
} from "@/search-area";

describe("Área de búsqueda", () => {
  it("default Rosario · 3 km, bounds y polígono", () => {
    assert.equal(SEARCH_AREA_RADIUS_MIN_KM, 0.5);
    assert.equal(SEARCH_AREA_RADIUS_MAX_KM, 10);
    const draft = createRosarioDefaultDraft();
    assert.equal(draft.name, "Rosario centro · 3 km");
    assert.equal(draft.radiusKm, "3");
    assert.equal(createRosarioDefaultArea().radiusKm, 3);
    assert.equal(
      createSearchArea({
        name: "x",
        center: { lat: -32.94, lng: -60.65 },
        radiusKm: 0.4,
        shape: "circle",
      }).ok,
      false,
    );
    assert.equal(
      createSearchArea({
        name: "x",
        center: { lat: -32.94, lng: -60.65 },
        radiusKm: 10.1,
        shape: "circle",
      }).ok,
      false,
    );
    draft.shape = "polygon";
    draft.polygonText = JSON.stringify([
      { lat: -32.94, lng: -60.65 },
      { lat: -32.95, lng: -60.65 },
      { lat: -32.95, lng: -60.66 },
    ]);
    assert.equal(draftToCreateInput(draft).ok, true);
  });

  it("memory + D1 fake: crear/listar/reutilizar + SQL", async () => {
    const memory = createMemorySearchAreaRepository({
      now: "2026-10-30T00:00:00.000Z",
    });
    assert.equal((await memory.list())[0]?.name, "Rosario centro · 3 km");
    await memory.create({
      name: "Fisherton · 2 km",
      center: { lat: -32.91, lng: -60.72 },
      radiusKm: 2,
      shape: "circle",
      id: "area_fisherton",
      now: "2026-10-30T01:00:00.000Z",
    });
    assert.equal((await memory.list()).length, 2);
    assert.ok(await memory.getById("area_rosario_centro_3km"));

    const rows = new Map<string, Record<string, unknown>>();
    const seed = createRosarioDefaultArea("2026-10-30T00:00:00.000Z");
    rows.set(seed.id, {
      id: seed.id,
      name: seed.name,
      center_lat: seed.center.lat,
      center_lng: seed.center.lng,
      radius_km: seed.radiusKm,
      shape: seed.shape,
      polygon_json: null,
      created_at: seed.createdAt,
      updated_at: seed.updatedAt,
    });
    const db: D1DatabaseLike = {
      prepare(query: string) {
        let bound: unknown[] = [];
        const stmt: D1PreparedStatement = {
          bind(...values: unknown[]) {
            bound = values;
            return stmt;
          },
          async all<T = Record<string, unknown>>() {
            return {
              results: [...rows.values()].sort((a, b) =>
                String(a.created_at).localeCompare(String(b.created_at)),
              ) as T[],
            };
          },
          async first<T = Record<string, unknown>>() {
            return (rows.get(String(bound[0])) as T) ?? null;
          },
          async run() {
            if (query.includes("INSERT")) {
              rows.set(String(bound[0]), {
                id: bound[0],
                name: bound[1],
                center_lat: bound[2],
                center_lng: bound[3],
                radius_km: bound[4],
                shape: bound[5],
                polygon_json: bound[6],
                created_at: bound[7],
                updated_at: bound[8],
              });
            }
            return {};
          },
        };
        return stmt;
      },
    };
    const d1 = createD1SearchAreaRepository(db);
    await d1.create({
      name: "Centro · 1 km",
      center: { lat: -32.94, lng: -60.65 },
      radiusKm: 1,
      shape: "circle",
      id: "area_centro_1",
      now: "2026-10-30T02:00:00.000Z",
    });
    assert.equal((await d1.list()).length, 2);
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../migrations/0001_search_areas.sql",
      ),
      "utf8",
    );
    assert.match(sql, /search_areas/);
    assert.match(sql, /area_rosario_centro_3km/);
  });
});
