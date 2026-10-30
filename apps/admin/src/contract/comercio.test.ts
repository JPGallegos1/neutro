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
  COMERCIOS_ATTRIBUTION,
  FOURSQUARE_ATTRIBUTION,
  OSM_ATTRIBUTION,
  comercioKey,
  comerciosFromFoursquare,
  comerciosFromOsm,
  createComercio,
  mergeComercios,
  pinKindFor,
  searchComerciosFromFixtures,
  type Comercio,
} from "@/comercio";
import { projectComercioPin } from "@/comercios-map";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function sample(name: string, lat: number, lng: number): Comercio {
  return createComercio({
    source: "osm",
    externalId: name,
    name,
    lat,
    lng,
  })!;
}

describe("Comercio — identidad y fuentes", () => {
  it("exige source + external_id estables", () => {
    const c = createComercio({
      source: "foursquare",
      externalId: "abc",
      name: "Local",
      lat: -32.94,
      lng: -60.65,
    });
    assert.ok(c);
    assert.equal(c?.source, "foursquare");
    assert.equal(c?.externalId, "abc");
    assert.equal(comercioKey(c!), "foursquare:abc");
    assert.equal(
      createComercio({
        source: "osm",
        externalId: " ",
        name: "X",
        lat: 1,
        lng: 1,
      }),
      null,
    );
  });

  it("parsea Foursquare y OSM con atribución", () => {
    const fsq = comerciosFromFoursquare([
      {
        fsq_place_id: "fsq1",
        name: "A",
        latitude: -32.94,
        longitude: -60.65,
      },
    ]);
    assert.equal(fsq[0]?.attribution, FOURSQUARE_ATTRIBUTION);
    const osm = comerciosFromOsm([
      {
        type: "node",
        id: 9,
        lat: -32.94,
        lon: -60.65,
        tags: { name: "B" },
      },
    ]);
    assert.equal(osm[0]?.externalId, "node/9");
    assert.equal(osm[0]?.attribution, OSM_ATTRIBUTION);
    assert.match(COMERCIOS_ATTRIBUTION, /OpenStreetMap/);
    assert.match(COMERCIOS_ATTRIBUTION, /Foursquare/);
  });

  it("merge por source+external_id sin duplicar", () => {
    const a = createComercio({
      source: "osm",
      externalId: "node/1",
      name: "Uno",
      lat: -32.94,
      lng: -60.65,
    })!;
    const dup = createComercio({
      source: "osm",
      externalId: "node/1",
      name: "Uno bis",
      lat: -32.94,
      lng: -60.65,
    })!;
    const b = createComercio({
      source: "foursquare",
      externalId: "fsq1",
      name: "Dos",
      lat: -32.95,
      lng: -60.66,
    })!;
    const merged = mergeComercios([[a, b], [dup]]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((c) => c.externalId === "node/1")?.name, "Uno");
  });

  it("fixtures Rosario producen comercios con keys y pins", () => {
    const list = searchComerciosFromFixtures();
    assert.ok(list.length >= 3);
    for (const c of list) {
      assert.ok(c.source === "foursquare" || c.source === "osm");
      assert.ok(c.externalId.length > 0);
      assert.match(comercioKey(c), /^(foursquare|osm):/);
    }
    const key = comercioKey(list[0]!);
    assert.equal(pinKindFor(key, new Set([key]), new Set()), "seleccionado");
    assert.equal(pinKindFor(key, new Set(), new Set([key])), "lead");
    assert.equal(pinKindFor(key, new Set(), new Set()), "comercio");
  });
});

describe("Comercios — secuencia hidratar → buscar → re-hydrate", () => {
  it("conserva el resultado de búsqueda si el loader rehidrata con snapshot viejo", () => {
    const loaded = [sample("loader", -32.94, -60.65)];
    const searched = [
      sample("buscado-a", -32.95, -60.66),
      sample("buscado-b", -32.96, -60.67),
    ];
    let state: AdminState = ADMIN_INITIAL_STATE;
    state = adminReducer(state, {
      type: "comerciosHydrated",
      comercios: loaded,
      revision: 100,
    });
    assert.equal(state.comerciosStatus, "ready");
    assert.equal(state.comercios[0]?.name, "loader");
    state = adminReducer(state, { type: "comerciosSearchRequested" });
    state = adminReducer(state, {
      type: "comerciosSearchSucceeded",
      comercios: searched,
      revision: 101,
    });
    assert.equal(state.comercios.length, 2);
    assert.equal(state.comercios[0]?.name, "buscado-a");
    state = adminReducer(state, {
      type: "comerciosHydrated",
      comercios: loaded,
      revision: 100,
    });
    assert.equal(state.comercios.length, 2);
    assert.equal(state.comercios[0]?.name, "buscado-a");
    assert.equal(state.comerciosRevision, 101);
    assert.equal(state.selectedComercioKeys.size, 0);
  });

  it("la página no despacha comerciosHydrated en el cuerpo de render", () => {
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    assert.doesNotMatch(page, /comerciosRevision\s*!==\s*loadedRevision/);
    assert.match(page, /comerciosStatus\s*===\s*"idle"\s*\?\s*loadedComercios/);
  });
});

describe("Comercios — mapa↔lista", () => {
  it("toggleComercio actualiza selectedComercioKeys y pin seleccionado", () => {
    const list = searchComerciosFromFixtures();
    const a = comercioKey(list[0]!);
    const b = comercioKey(list[1]!);
    let state = adminReducer(ADMIN_INITIAL_STATE, {
      type: "comerciosHydrated",
      comercios: list,
      revision: 1,
    });
    state = adminReducer(state, { type: "toggleComercio", key: a });
    state = adminReducer(state, { type: "toggleComercio", key: b });
    assert.equal(state.selectedComercioKeys.has(a), true);
    assert.equal(state.selectedComercioKeys.has(b), true);
    assert.equal(
      pinKindFor(b, state.selectedComercioKeys, state.leadKeys),
      "seleccionado",
    );
    assert.equal(
      pinKindFor(a, state.selectedComercioKeys, state.leadKeys),
      "seleccionado",
    );
  });

  it("toggleComercio es no-op si la key no existe en la lista", () => {
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
    assert.equal(next.selectedComercioKeys.size, 0);
    assert.equal(next, state);
  });

  it("proyección Y: norte (lat mayor) queda arriba (y menor)", () => {
    const center = { lat: -32.9442, lng: -60.6505 };
    const span = 0.04;
    const size = 320;
    const north = projectComercioPin(-32.94, -60.6505, center, span, size);
    const south = projectComercioPin(-32.95, -60.6505, center, span, size);
    assert.ok(north.y < south.y);
    assert.equal(north.y, ((center.lat - -32.94) / span + 0.5) * size);
    const invertedNorthY = ((-32.94 - center.lat) / span + 0.5) * size;
    assert.notEqual(north.y, invertedNorthY);
    assert.ok(invertedNorthY > north.y);
  });

  it("proyección X: este (lng mayor) queda a la derecha (x mayor)", () => {
    const center = { lat: -32.9442, lng: -60.6505 };
    const span = 0.04;
    const size = 320;
    const east = projectComercioPin(-32.9442, -60.64, center, span, size);
    const west = projectComercioPin(-32.9442, -60.66, center, span, size);
    assert.ok(east.x > west.x);
    assert.equal(east.x, ((-60.64 - center.lng) / span + 0.5) * size);
    const invertedEastX = ((center.lng - -60.64) / span + 0.5) * size;
    assert.notEqual(east.x, invertedEastX);
    assert.ok(invertedEastX < east.x);
  });

  it("atribución visible en la página vía COMERCIOS_ATTRIBUTION", () => {
    assert.ok(COMERCIOS_ATTRIBUTION.length > 0);
    assert.match(COMERCIOS_ATTRIBUTION, /OpenStreetMap/);
    assert.match(COMERCIOS_ATTRIBUTION, /Foursquare/);
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    assert.match(
      page,
      /data-admin-comercios-attribution[\s\S]*\{COMERCIOS_ATTRIBUTION\}/,
    );
    assert.doesNotMatch(
      page,
      /data-admin-comercios-attribution[\s\S]*>\s*<\/p>/,
    );
    assert.doesNotMatch(
      page,
      /data-admin-comercios-attribution[\s\S]*>\s*["']\s*["']\s*</,
    );
  });
});
