export type ComercioSource = "foursquare" | "osm";

export const NEUTRO_RUBROS = [
  "cafe",
  "panaderia",
  "kiosco",
  "gastronomia",
  "retail",
  "servicios",
  "otro",
] as const;

export type NeutroRubro = (typeof NEUTRO_RUBROS)[number];

export type Comercio = {
  source: ComercioSource;
  externalId: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
  address: string | null;
  socialUrls: string[];
  rubro: NeutroRubro;
  attribution: string;
};

export type ComerciosFilters = {
  sinWebsite: boolean;
  tieneRedes: boolean;
  rubro: NeutroRubro | null;
  ocultarGuardados: boolean;
};

export const DEFAULT_COMERCIOS_FILTERS: ComerciosFilters = {
  sinWebsite: true,
  tieneRedes: false,
  rubro: null,
  ocultarGuardados: false,
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
  socialUrls?: string[] | null;
  rubro?: NeutroRubro | null;
}): Comercio | null {
  const externalId = input.externalId.trim();
  const name = input.name.trim();
  if (!externalId || !name) return null;
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return null;
  const socialUrls = (input.socialUrls ?? [])
    .map((u) => u.trim())
    .filter(Boolean);
  return {
    source: input.source,
    externalId,
    name,
    lat: input.lat,
    lng: input.lng,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    socialUrls,
    rubro: input.rubro ?? "otro",
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

export function filterComercios(
  list: Comercio[],
  filters: ComerciosFilters,
  leadKeys: ReadonlySet<string>,
): Comercio[] {
  return list.filter((c) => {
    if (filters.sinWebsite && c.website) return false;
    if (filters.tieneRedes && c.socialUrls.length === 0) return false;
    if (filters.rubro && c.rubro !== filters.rubro) return false;
    if (filters.ocultarGuardados && leadKeys.has(comercioKey(c))) return false;
    return true;
  });
}

export type FoursquarePlaceLike = {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  website?: string | null;
  social_media?: string[] | null;
  categories?: string[] | null;
  location?: { formatted_address?: string | null };
};

function rubroFromLabels(labels: string[]): NeutroRubro {
  const blob = labels.join(" ").toLowerCase();
  if (/caf[eé]|coffee/.test(blob)) return "cafe";
  if (/panader|bakery|pastel/.test(blob)) return "panaderia";
  if (/kiosk|convenience|almacen|almacén/.test(blob)) return "kiosco";
  if (/restaurant|food|gastro|bar|comida/.test(blob)) return "gastronomia";
  if (/shop|retail|store|tienda/.test(blob)) return "retail";
  if (/service|servicio|salon|pelu/.test(blob)) return "servicios";
  return "otro";
}

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
      socialUrls: place.social_media ?? [],
      rubro: rubroFromLabels(place.categories ?? [place.name ?? ""]),
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

function socialsFromOsm(tags: Record<string, string | undefined>): string[] {
  const keys = [
    "contact:instagram",
    "contact:facebook",
    "contact:twitter",
    "instagram",
    "facebook",
  ];
  return keys.map((k) => tags[k]).filter((v): v is string => Boolean(v));
}

function rubroFromOsm(tags: Record<string, string | undefined>): NeutroRubro {
  return rubroFromLabels([
    tags.amenity ?? "",
    tags.shop ?? "",
    tags.cuisine ?? "",
    tags.name ?? "",
  ]);
}

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
      socialUrls: socialsFromOsm(tags),
      rubro: rubroFromOsm(tags),
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
    social_media: ["https://instagram.com/cafemitre"],
    categories: ["Cafe"],
    location: { formatted_address: "Mitre 700, Rosario" },
  },
  {
    fsq_place_id: "fsq_panaderia_centro",
    name: "Panadería Centro",
    latitude: -32.9438,
    longitude: -60.6512,
    website: "https://example.com/pan",
    social_media: [],
    categories: ["Bakery"],
    location: { formatted_address: "San Luis 1200, Rosario" },
  },
];

export const FIXTURE_OSM: OsmElementLike[] = [
  {
    type: "node",
    id: 1001,
    lat: -32.9445,
    lon: -60.6501,
    tags: {
      name: "Kiosco Sur",
      shop: "convenience",
      "contact:instagram": "https://instagram.com/kioscosur",
    },
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
  selectedKeys: ReadonlySet<string>,
  leadKeys: ReadonlySet<string>,
): PinKind {
  if (selectedKeys.has(key)) return "seleccionado";
  if (leadKeys.has(key)) return "lead";
  return "comercio";
}
