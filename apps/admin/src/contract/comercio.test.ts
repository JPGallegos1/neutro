import assert from "node:assert/strict";
import { describe, it } from "vitest";
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
} from "@/comercio";

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
    assert.equal(pinKindFor(key, key, new Set()), "seleccionado");
    assert.equal(pinKindFor(key, null, new Set([key])), "lead");
    assert.equal(pinKindFor(key, null, new Set()), "comercio");
  });
});
