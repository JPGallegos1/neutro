import {
  createSearchArea,
  type CreateSearchAreaInput,
  type LatLng,
  type SearchArea,
  type SearchAreaShape,
} from "@/search-area";
import type { SearchAreaRepository } from "@/search-area-repository";

export type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement;
};

type SearchAreaRow = {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  shape: string;
  polygon_json: string | null;
  created_at: string;
  updated_at: string;
};

function rowToArea(row: SearchAreaRow): SearchArea {
  const shape: SearchAreaShape = row.shape === "polygon" ? "polygon" : "circle";
  let polygon: LatLng[] | null = null;
  if (row.polygon_json) {
    const parsed: unknown = JSON.parse(row.polygon_json);
    if (Array.isArray(parsed)) {
      polygon = parsed as LatLng[];
    }
  }
  return {
    id: row.id,
    name: row.name,
    center: { lat: row.center_lat, lng: row.center_lng },
    radiusKm: row.radius_km,
    shape,
    polygon,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createD1SearchAreaRepository(
  db: D1DatabaseLike,
): SearchAreaRepository {
  return {
    async list() {
      const result = await db
        .prepare(
          `SELECT id, name, center_lat, center_lng, radius_km, shape, polygon_json, created_at, updated_at
           FROM search_areas
           ORDER BY created_at ASC`,
        )
        .all<SearchAreaRow>();
      return result.results.map(rowToArea);
    },
    async create(input: CreateSearchAreaInput) {
      const created = createSearchArea(input);
      if (!created.ok) {
        throw new Error(created.error);
      }
      const area = created.value;
      await db
        .prepare(
          `INSERT INTO search_areas (
             id, name, center_lat, center_lng, radius_km, shape, polygon_json, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          area.id,
          area.name,
          area.center.lat,
          area.center.lng,
          area.radiusKm,
          area.shape,
          area.polygon ? JSON.stringify(area.polygon) : null,
          area.createdAt,
          area.updatedAt,
        )
        .run();
      return area;
    },
    async getById(id: string) {
      const row = await db
        .prepare(
          `SELECT id, name, center_lat, center_lng, radius_km, shape, polygon_json, created_at, updated_at
           FROM search_areas
           WHERE id = ?
           LIMIT 1`,
        )
        .bind(id)
        .first<SearchAreaRow>();
      return row ? rowToArea(row) : null;
    },
  };
}
