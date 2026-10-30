export type ComercioSource = "foursquare" | "osm";

export type Comercio = {
  source: ComercioSource;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
  address: string | null;
  attribution: string;
};

export const FOURSQUARE_ATTRIBUTION = "Foursquare Open Places";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const COMERCIOS_ATTRIBUTION = `${OSM_ATTRIBUTION} · ${FOURSQUARE_ATTRIBUTION}`;

export function comercioKey(
  comercio: Pick<Comercio, "source" | "externalId">,
): string {
  return `${comercio.source}:${comercio.externalId}`;
}

export function createComercio(input: {
  source: ComercioSource;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  website?: string | null;
  address?: string | null;
}): Comercio | null {
  const externalId = input.externalId.trim();
  const name = input.name.trim();
  if (!externalId || !name) return null;
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return null;
  return {
    source: input.source,
    externalId,
    name,
    lat: input.lat,
    lng: input.lng,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    attribution:
      input.source === "osm" ? OSM_ATTRIBUTION : FOURSQUARE_ATTRIBUTION,
  };
}

export function mergeComercios(batches: Comercio[][]): Comercio[] {
  const map = new Map<string, Comercio>();
  for (const batch of batches) {
    for (const item of batch) {
      const key = comercioKey(item);
      if (!map.has(key)) map.set(key, item);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export type FoursquarePlaceLike = {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  website?: string | null;
  location?: { formatted_address?: string | null };
};

export function comerciosFromFoursquare(
  places: FoursquarePlaceLike[],
): Comercio[] {
  const out: Comercio[] = [];
  for (const place of places) {
    const created = createComercio({
      source: "foursquare",
      externalId: place.fsq_place_id ?? "",
      name: place.name ?? "",
      lat: Number(place.latitude),
      lng: Number(place.longitude),
      website: place.website ?? null,
      address: place.location?.formatted_address ?? null,
    });
    if (created) out.push(created);
  }
  return out;
}

export type OsmElementLike = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
};

export function comerciosFromOsm(elements: OsmElementLike[]): Comercio[] {
  const out: Comercio[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    const created = createComercio({
      source: "osm",
      externalId: `${el.type ?? "node"}/${el.id ?? ""}`,
      name: tags.name ?? "",
      lat: Number(lat),
      lng: Number(lng),
      website: tags.website ?? tags["contact:website"] ?? null,
      address: tags["addr:full"] ?? tags["addr:street"] ?? null,
    });
    if (created) out.push(created);
  }
  return out;
}

export const FIXTURE_FOURSQUARE: FoursquarePlaceLike[] = [
  {
    fsq_place_id: "fsq_cafe_mitre",
    name: "Café Mitre",
    latitude: -32.9451,
    longitude: -60.6498,
    website: null,
    location: { formatted_address: "Mitre 700, Rosario" },
  },
  {
    fsq_place_id: "fsq_panaderia_centro",
    name: "Panadería Centro",
    latitude: -32.9438,
    longitude: -60.6512,
    website: "https://example.com/pan",
    location: { formatted_address: "San Luis 1200, Rosario" },
  },
];

export const FIXTURE_OSM: OsmElementLike[] = [
  {
    type: "node",
    id: 1001,
    lat: -32.9445,
    lon: -60.6501,
    tags: { name: "Kiosco Sur", shop: "convenience" },
  },
  {
    type: "node",
    id: 1002,
    lat: -32.9451,
    lon: -60.6498,
    tags: {
      name: "Café Mitre OSM",
      amenity: "cafe",
      website: "https://osm.example/cafe",
    },
  },
];

export function searchComerciosFromFixtures(): Comercio[] {
  return mergeComercios([
    comerciosFromFoursquare(FIXTURE_FOURSQUARE),
    comerciosFromOsm(FIXTURE_OSM),
  ]);
}

export type PinKind = "comercio" | "lead" | "seleccionado";

export function pinKindFor(
  key: string,
  selectedKey: string | null,
  leadKeys: ReadonlySet<string>,
): PinKind {
  if (selectedKey === key) return "seleccionado";
  if (leadKeys.has(key)) return "lead";
  return "comercio";
}
