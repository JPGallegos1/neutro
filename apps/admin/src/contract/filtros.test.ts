import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import {
  ADMIN_INITIAL_STATE,
  adminReducer,
  type AdminState,
} from "@/admin-machine";
import {
  DEFAULT_COMERCIOS_FILTERS,
  NEUTRO_RUBROS,
  comercioKey,
  comerciosFromFoursquare,
  comerciosFromOsm,
  createComercio,
  filterComercios,
  pinKindFor,
  searchComerciosFromFixtures,
  type Comercio,
  type ComerciosFilters,
} from "@/comercio";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function c(input: {
  id: string;
  website?: string | null;
  socialUrls?: string[];
  rubro?: Comercio["rubro"];
}): Comercio {
  return createComercio({
    source: "osm",
    externalId: input.id,
    name: input.id,
    lat: -32.94,
    lng: -60.65,
    website: input.website ?? null,
    socialUrls: input.socialUrls ?? [],
    rubro: input.rubro ?? "otro",
  })!;
}

describe("Filtros de Comercios", () => {
  it("Sin website está on por defecto y es el primero en la UI", () => {
    assert.equal(DEFAULT_COMERCIOS_FILTERS.sinWebsite, true);
    assert.equal(DEFAULT_COMERCIOS_FILTERS.tieneRedes, false);
    assert.equal(DEFAULT_COMERCIOS_FILTERS.rubro, null);
    assert.equal(DEFAULT_COMERCIOS_FILTERS.ocultarGuardados, false);
    assert.equal(ADMIN_INITIAL_STATE.filters.sinWebsite, true);
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    assert.match(page, /data-admin-comercios-filters/);
    const sinIdx = page.indexOf("\n          Sin website\n");
    const redesIdx = page.indexOf("\n          Tiene redes\n");
    const rubroIdx = page.indexOf("\n          Rubro\n");
    const ocultarIdx = page.indexOf("\n          Ocultar ya guardados\n");
    assert.ok(sinIdx > 0);
    assert.ok(sinIdx < redesIdx);
    assert.ok(redesIdx < rubroIdx);
    assert.ok(rubroIdx < ocultarIdx);
  });

  it("filtra Sin website, Tiene redes, rubro y ocultar guardados", () => {
    const list = [
      c({ id: "a", website: null, socialUrls: [], rubro: "cafe" }),
      c({
        id: "b",
        website: "https://x.test",
        socialUrls: ["https://ig"],
        rubro: "cafe",
      }),
      c({
        id: "c",
        website: null,
        socialUrls: ["https://fb"],
        rubro: "kiosco",
      }),
      c({ id: "d", website: null, socialUrls: [], rubro: "panaderia" }),
    ];
    const leads = new Set([comercioKey(list[3]!)]);
    assert.deepEqual(
      filterComercios(list, { ...DEFAULT_COMERCIOS_FILTERS }, new Set()).map(
        (x) => x.externalId,
      ),
      ["a", "c", "d"],
    );
    const conRedes: ComerciosFilters = {
      ...DEFAULT_COMERCIOS_FILTERS,
      sinWebsite: false,
      tieneRedes: true,
    };
    assert.deepEqual(
      filterComercios(list, conRedes, new Set()).map((x) => x.externalId),
      ["b", "c"],
    );
    const rubroCafe: ComerciosFilters = {
      ...DEFAULT_COMERCIOS_FILTERS,
      rubro: "cafe",
    };
    assert.deepEqual(
      filterComercios(list, rubroCafe, new Set()).map((x) => x.externalId),
      ["a"],
    );
    const ocultar: ComerciosFilters = {
      ...DEFAULT_COMERCIOS_FILTERS,
      ocultarGuardados: true,
    };
    assert.deepEqual(
      filterComercios(list, ocultar, leads).map((x) => x.externalId),
      ["a", "c"],
    );
    assert.ok(NEUTRO_RUBROS.includes("cafe"));
    assert.ok(NEUTRO_RUBROS.includes("panaderia"));
    assert.ok(NEUTRO_RUBROS.includes("kiosco"));
  });

  it("fixtures responden al filtro Sin website por defecto", () => {
    const all = searchComerciosFromFixtures();
    assert.ok(all.some((x) => x.website));
    assert.ok(all.some((x) => !x.website));
    const filtered = filterComercios(all, DEFAULT_COMERCIOS_FILTERS, new Set());
    assert.ok(filtered.length > 0);
    assert.ok(filtered.every((x) => x.website === null));
    assert.ok(filtered.length < all.length);
  });

  it("mapa y lista reciben filteredComercios, no la lista cruda", () => {
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    assert.match(
      page,
      /const filteredComercios = filterComercios\(\s*all,\s*state\.filters,\s*state\.leadKeys,?\s*\)/,
    );
    assert.match(
      page,
      /<ComerciosMap\s+[\s\S]*?comercios=\{filteredComercios\}/,
    );
    assert.doesNotMatch(page, /<ComerciosMap\s+[\s\S]*?comercios=\{all\}/);
    assert.match(
      page,
      /data-admin-comercios-list[\s\S]*?\{filteredComercios\.map\(/,
    );
    assert.doesNotMatch(page, /data-admin-comercios-list[\s\S]*?\{all\.map\(/);
  });

  it("parsers FSQ y OSM traen redes y rubro desde la fuente", () => {
    const fsq = comerciosFromFoursquare([
      {
        fsq_place_id: "fsq_redes",
        name: "Local FSQ",
        latitude: -32.94,
        longitude: -60.65,
        social_media: ["https://instagram.com/fsq"],
        categories: ["Cafe", "Coffee Shop"],
      },
    ]);
    assert.equal(fsq.length, 1);
    assert.deepEqual(fsq[0]?.socialUrls, ["https://instagram.com/fsq"]);
    assert.equal(fsq[0]?.rubro, "cafe");
    const osm = comerciosFromOsm([
      {
        type: "node",
        id: 55,
        lat: -32.94,
        lon: -60.65,
        tags: {
          name: "Kiosco Red",
          shop: "convenience",
          "contact:instagram": "https://instagram.com/kiosco",
          "contact:facebook": "https://facebook.com/kiosco",
        },
      },
    ]);
    assert.equal(osm.length, 1);
    assert.deepEqual(osm[0]?.socialUrls, [
      "https://instagram.com/kiosco",
      "https://facebook.com/kiosco",
    ]);
    assert.equal(osm[0]?.rubro, "kiosco");
    const pan = comerciosFromFoursquare([
      {
        fsq_place_id: "fsq_pan",
        name: "Pan",
        latitude: -32.94,
        longitude: -60.65,
        categories: ["Bakery"],
      },
    ]);
    assert.equal(pan[0]?.rubro, "panaderia");
    assert.deepEqual(pan[0]?.socialUrls, []);
  });

  it("setComerciosFilters aplica rubro y Todos (null)", () => {
    let state = ADMIN_INITIAL_STATE;
    assert.equal(state.filters.rubro, null);
    state = adminReducer(state, {
      type: "setComerciosFilters",
      filters: { rubro: "cafe" },
    });
    assert.equal(state.filters.rubro, "cafe");
    state = adminReducer(state, {
      type: "setComerciosFilters",
      filters: { rubro: "kiosco" },
    });
    assert.equal(state.filters.rubro, "kiosco");
    state = adminReducer(state, {
      type: "setComerciosFilters",
      filters: { rubro: null },
    });
    assert.equal(state.filters.rubro, null);
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    assert.match(
      page,
      /data-admin-filter="rubro"[\s\S]*?setComerciosFilters[\s\S]*?rubro:/,
    );
  });
});

describe("Selección múltiple de Comercios", () => {
  it("toggle agrega y quita keys; filtros no borran la selección", () => {
    const list = searchComerciosFromFixtures();
    let state: AdminState = adminReducer(ADMIN_INITIAL_STATE, {
      type: "comerciosHydrated",
      comercios: list,
      revision: 1,
    });
    const a = comercioKey(list[0]!);
    const b = comercioKey(list[1]!);
    state = adminReducer(state, { type: "toggleComercio", key: a });
    state = adminReducer(state, { type: "toggleComercio", key: b });
    assert.equal(state.selectedComercioKeys.has(a), true);
    assert.equal(state.selectedComercioKeys.has(b), true);
    assert.equal(state.selectedComercioKeys.size, 2);
    state = adminReducer(state, { type: "toggleComercio", key: a });
    assert.equal(state.selectedComercioKeys.has(a), false);
    assert.equal(state.selectedComercioKeys.has(b), true);
    state = adminReducer(state, {
      type: "setComerciosFilters",
      filters: { sinWebsite: false },
    });
    assert.equal(state.filters.sinWebsite, false);
    assert.equal(state.selectedComercioKeys.has(b), true);
  });

  it("toggle es no-op si la key no existe", () => {
    const list = searchComerciosFromFixtures();
    let state = adminReducer(ADMIN_INITIAL_STATE, {
      type: "comerciosHydrated",
      comercios: list,
      revision: 1,
    });
    const next = adminReducer(state, {
      type: "toggleComercio",
      key: "osm:no-existe",
    });
    assert.equal(next, state);
  });

  it("toggle con seed hidrata desde idle y selecciona", () => {
    const list = searchComerciosFromFixtures();
    const key = comercioKey(list[0]!);
    const next = adminReducer(ADMIN_INITIAL_STATE, {
      type: "toggleComercio",
      key,
      seed: { comercios: list, revision: 7 },
    });
    assert.equal(next.comerciosStatus, "ready");
    assert.equal(next.comerciosRevision, 7);
    assert.equal(next.selectedComercioKeys.has(key), true);
  });

  it("mapa, lista y contador reflejan selectedComercioKeys", () => {
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    const map = readFileSync(join(srcRoot, "comercios-map.tsx"), "utf8");
    assert.match(page, /selectedKeys=\{state\.selectedComercioKeys\}/);
    assert.match(page, /aria-pressed=\{selected\}/);
    assert.match(
      page,
      /data-admin-selection-count[\s\S]*\{state\.selectedComercioKeys\.size\} seleccionados/,
    );
    assert.doesNotMatch(
      page,
      /data-admin-selection-count[\s\S]*>\s*0 seleccionados/,
    );
    assert.match(map, /selectedKeys/);
    assert.match(map, /pinKindFor\(\s*key,\s*selectedKeys/);
    const a = "osm:a";
    const b = "osm:b";
    assert.equal(pinKindFor(a, new Set([a, b]), new Set()), "seleccionado");
    assert.equal(pinKindFor(b, new Set([a, b]), new Set()), "seleccionado");
    assert.equal(pinKindFor("osm:c", new Set([a, b]), new Set()), "comercio");
  });
});
