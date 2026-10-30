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
import { createRosarioDefaultArea } from "@/search-area";

type Row = Record<string, unknown>;

function createFakeD1() {
  const rows = new Map<string, Row>();
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

  function statement(query: string): D1PreparedStatement {
    let bound: unknown[] = [];
    const api: D1PreparedStatement = {
      bind(...values: unknown[]) {
        bound = values;
        return api;
      },
      async all<T = Row>() {
        if (query.includes("FROM search_areas") && query.includes("ORDER BY")) {
          const results = [...rows.values()].sort((a, b) =>
            String(a.created_at).localeCompare(String(b.created_at)),
          );
          return { results: results as T[] };
        }
        return { results: [] as T[] };
      },
      async first<T = Row>() {
        if (query.includes("WHERE id = ?")) {
          const id = String(bound[0]);
          return (rows.get(id) as T) ?? null;
        }
        return null;
      },
      async run() {
        if (query.includes("INSERT INTO search_areas")) {
          const id = String(bound[0]);
          rows.set(id, {
            id,
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
        return { success: true };
      },
    };
    return api;
  }

  const db: D1DatabaseLike = {
    prepare(query: string) {
      return statement(query);
    },
  };

  return { db, rows };
}

describe("D1 search area repository (fake)", () => {
  it("lista y crea Áreas sobre el adapter D1", async () => {
    const { db } = createFakeD1();
    const repo = createD1SearchAreaRepository(db);
    const listed = await repo.list();
    assert.equal(listed[0]?.name, "Rosario centro · 3 km");

    const created = await repo.create({
      name: "Centro · 1 km",
      center: { lat: -32.94, lng: -60.65 },
      radiusKm: 1,
      shape: "circle",
      id: "area_centro_1",
      now: "2026-10-30T02:00:00.000Z",
    });
    assert.equal(created.id, "area_centro_1");
    assert.equal((await repo.list()).length, 2);
    assert.equal((await repo.getById("area_centro_1"))?.radiusKm, 1);
  });
});

describe("migración search_areas", () => {
  it("define tabla search_areas y seed Rosario", () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../migrations/0001_search_areas.sql",
      ),
      "utf8",
    );
    assert.match(sql, /CREATE TABLE IF NOT EXISTS search_areas/);
    assert.match(sql, /radius_km/);
    assert.match(sql, /Rosario centro · 3 km/);
    assert.match(sql, /area_rosario_centro_3km/);
    assert.match(sql, /CHECK \(shape IN \('circle', 'polygon'\)\)/);
  });
});
