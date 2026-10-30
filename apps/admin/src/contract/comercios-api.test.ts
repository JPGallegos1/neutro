import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { searchComerciosFromFixtures } from "@/comercio";
import worker, { type AdminWorkerEnv } from "../../worker/index";

function env(overrides?: Partial<AdminWorkerEnv>): AdminWorkerEnv {
  return {
    DB: {
      prepare() {
        throw new Error("db_unused");
      },
    },
    ASSETS: {
      fetch: async () => new Response("asset"),
    },
    FOURSQUARE_API_KEY: "secret-fsq-key-should-never-leak",
    ...overrides,
  };
}

describe("GET /api/comercios", () => {
  it("200 con { comercios } y sin secretos", async () => {
    const res = await worker.fetch(
      new Request(
        "https://admin.test/api/comercios?lat=-32.9442&lng=-60.6505&radiusKm=3",
      ),
      env(),
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
    const body = (await res.json()) as {
      comercios?: unknown;
      FOURSQUARE_API_KEY?: unknown;
    };
    assert.ok(Array.isArray(body.comercios));
    assert.equal(
      (body.comercios as unknown[]).length,
      searchComerciosFromFixtures().length,
    );
    assert.equal("FOURSQUARE_API_KEY" in body, false);
    assert.equal(JSON.stringify(body).includes("secret-fsq-key"), false);
    assert.equal(JSON.stringify(body).includes("FOURSQUARE_API_KEY"), false);
  });

  it("400 invalid_query si lat/lng inválidos", async () => {
    const res = await worker.fetch(
      new Request("https://admin.test/api/comercios?lat=x&lng=-60.65"),
      env(),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "invalid_query" });
  });

  it("400 si lat/lng no finitos", async () => {
    const nan = await worker.fetch(
      new Request("https://admin.test/api/comercios?lat=NaN&lng=-60.65"),
      env(),
    );
    assert.equal(nan.status, 400);
    assert.deepEqual(await nan.json(), { error: "invalid_query" });
    const inf = await worker.fetch(
      new Request("https://admin.test/api/comercios?lat=-32.94&lng=Infinity"),
      env(),
    );
    assert.equal(inf.status, 400);
    assert.deepEqual(await inf.json(), { error: "invalid_query" });
  });

  it("400 si falta lng numérico", async () => {
    const res = await worker.fetch(
      new Request("https://admin.test/api/comercios?lat=-32.94"),
      env(),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, "invalid_query");
  });
});
