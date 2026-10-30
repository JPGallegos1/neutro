export const SEARCH_AREA_RADIUS_MIN_KM = 0.5;
export const SEARCH_AREA_RADIUS_MAX_KM = 10;

export const ROSARIO_CENTER = {
  lat: -32.9442,
  lng: -60.6505,
} as const;

export type LatLng = {
  lat: number;
  lng: number;
};

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
    center: { lat: ROSARIO_CENTER.lat, lng: ROSARIO_CENTER.lng },
    radiusKm: 3,
    shape: "circle",
    polygon: null,
    createdAt: now,
    updatedAt: now,
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function parsePolygonText(text: string): SearchAreaResult<LatLng[]> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "polygon_required" };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.length < 3) {
      return { ok: false, error: "polygon_invalid" };
    }
    const points: LatLng[] = [];
    for (const item of parsed) {
      if (
        item === null ||
        typeof item !== "object" ||
        !("lat" in item) ||
        !("lng" in item)
      ) {
        return { ok: false, error: "polygon_invalid" };
      }
      const lat = Number((item as { lat: unknown }).lat);
      const lng = Number((item as { lng: unknown }).lng);
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
        return { ok: false, error: "polygon_invalid" };
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { ok: false, error: "polygon_invalid" };
      }
      points.push({ lat, lng });
    }
    return { ok: true, value: points };
  } catch {
    return { ok: false, error: "polygon_invalid" };
  }
}

export function draftToCreateInput(
  draft: SearchAreaDraft,
): SearchAreaResult<CreateSearchAreaInput> {
  const name = draft.name.trim();
  if (name.length === 0) {
    return { ok: false, error: "name_required" };
  }
  const centerLat = Number(draft.centerLat);
  const centerLng = Number(draft.centerLng);
  if (
    !isFiniteNumber(centerLat) ||
    !isFiniteNumber(centerLng) ||
    centerLat < -90 ||
    centerLat > 90 ||
    centerLng < -180 ||
    centerLng > 180
  ) {
    return { ok: false, error: "center_invalid" };
  }
  const radiusKm = Number(draft.radiusKm);
  if (
    !isFiniteNumber(radiusKm) ||
    radiusKm < SEARCH_AREA_RADIUS_MIN_KM ||
    radiusKm > SEARCH_AREA_RADIUS_MAX_KM
  ) {
    return { ok: false, error: "radius_out_of_bounds" };
  }
  if (draft.shape === "circle") {
    return {
      ok: true,
      value: {
        name,
        center: { lat: centerLat, lng: centerLng },
        radiusKm,
        shape: "circle",
        polygon: null,
      },
    };
  }
  const polygon = parsePolygonText(draft.polygonText);
  if (!polygon.ok) return polygon;
  return {
    ok: true,
    value: {
      name,
      center: { lat: centerLat, lng: centerLng },
      radiusKm,
      shape: "polygon",
      polygon: polygon.value,
    },
  };
}

export function createSearchArea(
  input: CreateSearchAreaInput,
): SearchAreaResult<SearchArea> {
  const name = input.name.trim();
  if (name.length === 0) {
    return { ok: false, error: "name_required" };
  }
  if (
    !isFiniteNumber(input.center.lat) ||
    !isFiniteNumber(input.center.lng) ||
    input.center.lat < -90 ||
    input.center.lat > 90 ||
    input.center.lng < -180 ||
    input.center.lng > 180
  ) {
    return { ok: false, error: "center_invalid" };
  }
  if (
    input.radiusKm < SEARCH_AREA_RADIUS_MIN_KM ||
    input.radiusKm > SEARCH_AREA_RADIUS_MAX_KM
  ) {
    return { ok: false, error: "radius_out_of_bounds" };
  }
  if (input.shape === "polygon") {
    const polygon = input.polygon ?? null;
    if (polygon === null || polygon.length < 3) {
      return { ok: false, error: "polygon_required" };
    }
  }
  const now = input.now ?? new Date().toISOString();
  const id = input.id ?? `area_${crypto.randomUUID()}`;
  return {
    ok: true,
    value: {
      id,
      name,
      center: { lat: input.center.lat, lng: input.center.lng },
      radiusKm: input.radiusKm,
      shape: input.shape,
      polygon: input.shape === "polygon" ? (input.polygon ?? null) : null,
      createdAt: now,
      updatedAt: now,
    },
  };
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
