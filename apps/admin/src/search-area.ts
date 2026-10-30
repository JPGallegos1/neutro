export const SEARCH_AREA_RADIUS_MIN_KM = 0.5;
export const SEARCH_AREA_RADIUS_MAX_KM = 10;
export const ROSARIO_CENTER = { lat: -32.9442, lng: -60.6505 } as const;

export type LatLng = { lat: number; lng: number };
export type SearchAreaShape = "circle" | "polygon";

export type SearchArea = {
  id: string;
  name: string;
  center: LatLng;
  radiusKm: number;
  shape: SearchAreaShape;
  polygon: LatLng[] | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchAreaDraft = {
  name: string;
  centerLat: string;
  centerLng: string;
  radiusKm: string;
  shape: SearchAreaShape;
  polygonText: string;
};

export type CreateSearchAreaInput = {
  name: string;
  center: LatLng;
  radiusKm: number;
  shape: SearchAreaShape;
  polygon?: LatLng[] | null;
  id?: string;
  now?: string;
};

export type SearchAreaValidationError =
  | "name_required"
  | "radius_out_of_bounds"
  | "center_invalid"
  | "polygon_required"
  | "polygon_invalid";

export type SearchAreaResult<T> =
  { ok: true; value: T } | { ok: false; error: SearchAreaValidationError };

export type SearchAreaRepository = {
  list(): Promise<SearchArea[]>;
  create(input: CreateSearchAreaInput): Promise<SearchArea>;
  getById(id: string): Promise<SearchArea | null>;
};

export function createRosarioDefaultDraft(): SearchAreaDraft {
  return {
    name: "Rosario centro · 3 km",
    centerLat: String(ROSARIO_CENTER.lat),
    centerLng: String(ROSARIO_CENTER.lng),
    radiusKm: "3",
    shape: "circle",
    polygonText: "",
  };
}

export function createRosarioDefaultArea(
  now = new Date().toISOString(),
): SearchArea {
  return {
    id: "area_rosario_centro_3km",
    name: "Rosario centro · 3 km",
    center: { ...ROSARIO_CENTER },
    radiusKm: 3,
    shape: "circle",
    polygon: null,
    createdAt: now,
    updatedAt: now,
  };
}

function parsePolygon(text: string): SearchAreaResult<LatLng[]> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "polygon_required" };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length < 3) {
      return { ok: false, error: "polygon_invalid" };
    }
    const points: LatLng[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return { ok: false, error: "polygon_invalid" };
      }
      const lat = Number((item as { lat?: unknown }).lat);
      const lng = Number((item as { lng?: unknown }).lng);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return { ok: false, error: "polygon_invalid" };
      }
      points.push({ lat, lng });
    }
    return { ok: true, value: points };
  } catch {
    return { ok: false, error: "polygon_invalid" };
  }
}

export function createSearchArea(
  input: CreateSearchAreaInput,
): SearchAreaResult<SearchArea> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "name_required" };
  const { lat, lng } = input.center;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { ok: false, error: "center_invalid" };
  }
  if (
    input.radiusKm < SEARCH_AREA_RADIUS_MIN_KM ||
    input.radiusKm > SEARCH_AREA_RADIUS_MAX_KM
  ) {
    return { ok: false, error: "radius_out_of_bounds" };
  }
  if (
    input.shape === "polygon" &&
    (!input.polygon || input.polygon.length < 3)
  ) {
    return { ok: false, error: "polygon_required" };
  }
  const now = input.now ?? new Date().toISOString();
  return {
    ok: true,
    value: {
      id: input.id ?? `area_${crypto.randomUUID()}`,
      name,
      center: { lat, lng },
      radiusKm: input.radiusKm,
      shape: input.shape,
      polygon: input.shape === "polygon" ? (input.polygon ?? null) : null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function draftToCreateInput(
  draft: SearchAreaDraft,
): SearchAreaResult<CreateSearchAreaInput> {
  let polygon: LatLng[] | null = null;
  if (draft.shape === "polygon") {
    const parsed = parsePolygon(draft.polygonText);
    if (!parsed.ok) return parsed;
    polygon = parsed.value;
  }
  const input: CreateSearchAreaInput = {
    name: draft.name,
    center: { lat: Number(draft.centerLat), lng: Number(draft.centerLng) },
    radiusKm: Number(draft.radiusKm),
    shape: draft.shape,
    polygon,
  };
  const validated = createSearchArea({ ...input, id: "draft_tmp" });
  if (!validated.ok) return validated;
  return { ok: true, value: input };
}

export function areaToDraft(area: SearchArea): SearchAreaDraft {
  return {
    name: area.name,
    centerLat: String(area.center.lat),
    centerLng: String(area.center.lng),
    radiusKm: String(area.radiusKm),
    shape: area.shape,
    polygonText: area.polygon ? JSON.stringify(area.polygon) : "",
  };
}

export function createMemorySearchAreaRepository(options?: {
  seedRosario?: boolean;
  now?: string;
}): SearchAreaRepository {
  const areas = new Map<string, SearchArea>();
  if (options?.seedRosario !== false) {
    const seed = createRosarioDefaultArea(options?.now);
    areas.set(seed.id, seed);
  }
  return {
    async list() {
      return [...areas.values()].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
    },
    async create(input) {
      const result = createSearchArea(input);
      if (!result.ok) throw new Error(result.error);
      areas.set(result.value.id, result.value);
      return result.value;
    },
    async getById(id) {
      return areas.get(id) ?? null;
    },
  };
}
