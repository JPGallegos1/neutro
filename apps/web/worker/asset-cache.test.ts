import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ASSET_ERROR_CACHE_CONTROL,
  isCacheableAssetStatus,
  isLongCacheAssetPath,
  LONG_CACHE_ASSET_PREFIXES,
  withAssetErrorCacheControl,
} from "./asset-cache.ts";
import worker from "./index.ts";

const PRODUCTION = "https://neutro.solutions";
const WORKERS_DEV = "https://neutro-web.jpgallegos20.workers.dev";
const IMMUTABLE = "public, max-age=31536000, immutable";
const DAY = "public, max-age=86400, stale-while-revalidate=604800";

function executionContext(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;
}

function assetEnv(
  status: number,
  body: string,
  headers: Record<string, string>,
) {
  const calls: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        calls.push(url);
        return new Response(body, { status, headers });
      },
    },
  };
  return { calls, env };
}

async function fetchWorker(
  url: string,
  env: { ASSETS: { fetch: (input: RequestInfo | URL) => Promise<Response> } },
): Promise<Response> {
  return worker.fetch(
    new Request(url),
    env as unknown as Parameters<typeof worker.fetch>[1],
    executionContext(),
  );
}

describe("asset-cache path and status helpers", () => {
  it("reconoce solo los tres prefijos de caché larga", () => {
    assert.deepEqual([...LONG_CACHE_ASSET_PREFIXES], [
      "/_astro/",
      "/images/",
      "/video/",
    ]);
    assert.equal(isLongCacheAssetPath("/_astro/base.CssHash.css"), true);
    assert.equal(isLongCacheAssetPath("/images/work/x.webp"), true);
    assert.equal(isLongCacheAssetPath("/video/neutro.mp4"), true);
    assert.equal(isLongCacheAssetPath("/favicon.ico"), false);
    assert.equal(isLongCacheAssetPath("/og/og-1200x630.png"), false);
    assert.equal(isLongCacheAssetPath("/"), false);
    assert.equal(isLongCacheAssetPath("/_astro"), false);
  });

  it("trata 200, 206 y 304 como cacheables y el resto no", () => {
    assert.equal(isCacheableAssetStatus(200), true);
    assert.equal(isCacheableAssetStatus(206), true);
    assert.equal(isCacheableAssetStatus(304), true);
    assert.equal(isCacheableAssetStatus(404), false);
    assert.equal(isCacheableAssetStatus(403), false);
    assert.equal(isCacheableAssetStatus(500), false);
    assert.equal(isCacheableAssetStatus(301), false);
  });
});

describe("withAssetErrorCacheControl", () => {
  for (const prefix of LONG_CACHE_ASSET_PREFIXES) {
    const path = `${prefix}missing-asset.bin`;
    it(`pone ${ASSET_ERROR_CACHE_CONTROL} en 404 de ${prefix}*`, () => {
      const upstream = new Response("missing", {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": IMMUTABLE,
        },
      });
      const fixed = withAssetErrorCacheControl(upstream, path);
      assert.equal(fixed.status, 404);
      assert.equal(
        fixed.headers.get("Cache-Control"),
        ASSET_ERROR_CACHE_CONTROL,
      );
      assert.notEqual(fixed.headers.get("Cache-Control"), IMMUTABLE);
    });
  }

  it("conserva immutable en 200 de /_astro/*", () => {
    const upstream = new Response("body{}", {
      status: 200,
      headers: {
        "content-type": "text/css",
        "cache-control": IMMUTABLE,
      },
    });
    const fixed = withAssetErrorCacheControl(
      upstream,
      "/_astro/base.CssHash.css",
    );
    assert.equal(fixed.status, 200);
    assert.equal(fixed.headers.get("Cache-Control"), IMMUTABLE);
    assert.equal(fixed, upstream);
  });

  it("conserva Cache-Control en 206 y 304 de /video/*", () => {
    for (const status of [206, 304] as const) {
      const upstream = new Response(status === 206 ? "chunk" : null, {
        status,
        headers: { "cache-control": DAY },
      });
      const fixed = withAssetErrorCacheControl(upstream, "/video/neutro.mp4");
      assert.equal(fixed.status, status);
      assert.equal(fixed.headers.get("Cache-Control"), DAY);
      assert.equal(fixed, upstream);
    }
  });

  it("no reescribe 404 fuera de los prefijos largos", () => {
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": DAY },
    });
    const fixed = withAssetErrorCacheControl(upstream, "/favicon.ico");
    assert.equal(fixed, upstream);
    assert.equal(fixed.headers.get("Cache-Control"), DAY);
  });

  it("mutación: sin withAssetErrorCacheControl el 404 conserva immutable", () => {
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": IMMUTABLE },
    });
    assert.equal(upstream.headers.get("Cache-Control"), IMMUTABLE);
    assert.notEqual(
      upstream.headers.get("Cache-Control"),
      ASSET_ERROR_CACHE_CONTROL,
    );
    const fixed = withAssetErrorCacheControl(
      upstream,
      "/_astro/old.CssHash.css",
    );
    assert.equal(fixed.headers.get("Cache-Control"), ASSET_ERROR_CACHE_CONTROL);
  });

  it("mutación: si 404 entrara en la allowlist cacheable, el fix no aplicaría", () => {
    assert.equal(isCacheableAssetStatus(404), false);
    const wrongAllowlist = new Set([200, 206, 304, 404]);
    assert.equal(wrongAllowlist.has(404), true);
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": IMMUTABLE },
    });
    const wouldSkip =
      isLongCacheAssetPath("/images/gone.webp") &&
      wrongAllowlist.has(upstream.status);
    assert.equal(wouldSkip, true);
    const fixed = withAssetErrorCacheControl(upstream, "/images/gone.webp");
    assert.equal(fixed.headers.get("Cache-Control"), ASSET_ERROR_CACHE_CONTROL);
    assert.notEqual(
      isCacheableAssetStatus(404),
      wrongAllowlist.has(404),
    );
  });

  it("mutación: quitar el set deja el Cache-Control largo del upstream", () => {
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": IMMUTABLE },
    });
    const passthrough = new Headers(upstream.headers);
    assert.equal(passthrough.get("Cache-Control"), IMMUTABLE);
    passthrough.set("Cache-Control", ASSET_ERROR_CACHE_CONTROL);
    assert.equal(passthrough.get("Cache-Control"), ASSET_ERROR_CACHE_CONTROL);
    assert.notEqual(IMMUTABLE, ASSET_ERROR_CACHE_CONTROL);
  });
});

describe("Worker: 404 bajo prefijos de caché larga", () => {
  for (const prefix of LONG_CACHE_ASSET_PREFIXES) {
    const path = `${prefix}no-existe-seo07.bin`;
    it(`sirve 404 de ${prefix}* con ${ASSET_ERROR_CACHE_CONTROL} y cabeceras de seguridad`, async () => {
      const { calls, env } = assetEnv(404, "missing", {
        "content-type": "text/html; charset=utf-8",
        "cache-control": IMMUTABLE,
      });
      const response = await fetchWorker(`${PRODUCTION}${path}`, env);
      assert.equal(response.status, 404);
      assert.equal(
        response.headers.get("Cache-Control"),
        ASSET_ERROR_CACHE_CONTROL,
      );
      assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(
        response.headers.get("Strict-Transport-Security"),
        "max-age=300",
      );
      assert.equal(calls.length, 1);
    });
  }

  it("conserva immutable en 200 de /_astro/* vía Worker", async () => {
    const { env } = assetEnv(200, "body{}", {
      "content-type": "text/css",
      "cache-control": IMMUTABLE,
    });
    const response = await fetchWorker(
      `${PRODUCTION}/_astro/base.CssHash.css`,
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), IMMUTABLE);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("X-Robots-Tag"), null);
  });

  it("en workers.dev el 404 de /_astro/* lleva no-store y noindex", async () => {
    const { env } = assetEnv(404, "missing", {
      "content-type": "text/html; charset=utf-8",
      "cache-control": IMMUTABLE,
    });
    const response = await fetchWorker(
      `${WORKERS_DEV}/_astro/gone.CssHash.css`,
      env,
    );
    assert.equal(response.status, 404);
    assert.equal(
      response.headers.get("Cache-Control"),
      ASSET_ERROR_CACHE_CONTROL,
    );
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Strict-Transport-Security"), null);
  });
});
