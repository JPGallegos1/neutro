import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ASSET_ERROR_CACHE_CONTROL,
  isCacheableAssetStatus,
  isLongCacheAssetPath,
  LONG_CACHE_ASSET_EXACT_PATHS,
  LONG_CACHE_ASSET_PREFIXES,
  withAssetErrorCacheControl,
} from "./asset-cache.ts";
import worker from "./index.ts";

const PRODUCTION = "https://neutro.solutions";
const WORKERS_DEV = "https://neutro-web.jpgallegos20.workers.dev";
const IMMUTABLE = "public, max-age=31536000, immutable";
const HOUR = "public, max-age=3600";
const HTML_DEFAULT = "public, max-age=0, must-revalidate";
const INDEX_SOURCE = readFileSync(
  fileURLToPath(new URL("./index.ts", import.meta.url)),
  "utf8",
);

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
  init?: RequestInit,
): Promise<Response> {
  return worker.fetch(
    new Request(url, init),
    env as unknown as Parameters<typeof worker.fetch>[1],
    executionContext(),
  );
}

const ERROR_SCOPE_PATHS = [
  ...LONG_CACHE_ASSET_PREFIXES.map((prefix) => `${prefix}missing-asset.bin`),
  ...LONG_CACHE_ASSET_EXACT_PATHS,
] as const;

describe("asset-cache path and status helpers", () => {
  it("fija ASSET_ERROR_CACHE_CONTROL en el literal no-store", () => {
    assert.equal(ASSET_ERROR_CACHE_CONTROL, "no-store");
    assert.notEqual(ASSET_ERROR_CACHE_CONTROL, "no-cache");
  });

  it("reconoce prefijos con startsWith y favicons/manifest por ruta exacta", () => {
    assert.deepEqual([...LONG_CACHE_ASSET_PREFIXES], [
      "/_astro/",
      "/images/",
      "/video/",
      "/og/",
    ]);
    assert.deepEqual([...LONG_CACHE_ASSET_EXACT_PATHS], [
      "/favicon.ico",
      "/favicon.svg",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/apple-touch-icon.png",
      "/icon-192.png",
      "/icon-512.png",
      "/site.webmanifest",
    ]);
    assert.equal(isLongCacheAssetPath("/_astro/base.CssHash.css"), true);
    assert.equal(isLongCacheAssetPath("/images/work/x.webp"), true);
    assert.equal(isLongCacheAssetPath("/video/neutro.mp4"), true);
    assert.equal(isLongCacheAssetPath("/og/og-1200x630.png"), true);
    assert.equal(isLongCacheAssetPath("/favicon.ico"), true);
    assert.equal(isLongCacheAssetPath("/site.webmanifest"), true);
    assert.equal(isLongCacheAssetPath("/"), false);
    assert.equal(isLongCacheAssetPath("/_astro"), false);
    assert.equal(isLongCacheAssetPath("/favicon.ico.bak"), false);
    assert.equal(isLongCacheAssetPath("/x/images/x"), false);
    assert.equal(isLongCacheAssetPath("/images-other/x"), false);
    assert.equal(isLongCacheAssetPath("/x/og/x"), false);
    assert.equal(isLongCacheAssetPath("/og-other/x"), false);
    assert.equal("/x/images/x".includes("/images/"), true);
    assert.equal("/images-other/x".includes("/images/"), false);
    assert.equal("/x/og/x".includes("/og/"), true);
    assert.equal("/og-other/x".includes("/og/"), false);
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
  for (const path of ERROR_SCOPE_PATHS) {
    it(`pone no-store literal en 404 de ${path}`, () => {
      const upstream = new Response("missing", {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": IMMUTABLE,
        },
      });
      const fixed = withAssetErrorCacheControl(upstream, path);
      assert.equal(fixed.status, 404);
      assert.equal(fixed.headers.get("Cache-Control"), "no-store");
      assert.equal(
        fixed.headers.get("Cache-Control"),
        ASSET_ERROR_CACHE_CONTROL,
      );
      assert.notEqual(fixed.headers.get("Cache-Control"), "no-cache");
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

  it("conserva max-age=3600 en 200 de /images/* y /og/*", () => {
    for (const path of ["/images/work/x.webp", "/og/og-1200x630.png"] as const) {
      const upstream = new Response("bin", {
        status: 200,
        headers: { "cache-control": HOUR },
      });
      const fixed = withAssetErrorCacheControl(upstream, path);
      assert.equal(fixed.status, 200);
      assert.equal(fixed.headers.get("Cache-Control"), "public, max-age=3600");
      assert.equal(
        fixed.headers.get("Cache-Control")?.includes("stale-while-revalidate"),
        false,
      );
      assert.equal(fixed, upstream);
    }
  });

  it("conserva Cache-Control en 206 y 304 de /video/*", () => {
    for (const status of [206, 304] as const) {
      const upstream = new Response(status === 206 ? "chunk" : null, {
        status,
        headers: { "cache-control": HOUR },
      });
      const fixed = withAssetErrorCacheControl(upstream, "/video/neutro.mp4");
      assert.equal(fixed.status, status);
      assert.equal(fixed.headers.get("Cache-Control"), HOUR);
      assert.equal(fixed, upstream);
    }
  });

  it("no aplica a /x/images/x, /images-other/x, /x/og/x ni /og-other/x", () => {
    for (const path of [
      "/x/images/x",
      "/images-other/x",
      "/x/og/x",
      "/og-other/x",
    ] as const) {
      assert.equal(isLongCacheAssetPath(path), false);
      const upstream = new Response("missing", {
        status: 404,
        headers: { "cache-control": IMMUTABLE },
      });
      const fixed = withAssetErrorCacheControl(upstream, path);
      assert.equal(fixed, upstream);
      assert.equal(fixed.headers.get("Cache-Control"), IMMUTABLE);
      assert.notEqual(fixed.headers.get("Cache-Control"), "no-store");
    }
  });

  it("propaga webSocket y cf al reconstruir un 404", () => {
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": IMMUTABLE },
    });
    Object.defineProperty(upstream, "webSocket", {
      value: null,
      configurable: true,
    });
    Object.defineProperty(upstream, "cf", {
      value: { cacheStatus: "MISS", neutroProbe: "asset-cache" },
      configurable: true,
    });

    const OriginalResponse = globalThis.Response;
    const inits: ResponseInit[] = [];
    globalThis.Response = class extends OriginalResponse {
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        inits.push(init ?? {});
        super(body, init);
      }
    } as typeof Response;

    try {
      const fixed = withAssetErrorCacheControl(
        upstream,
        "/_astro/gone.CssHash.css",
      );
      assert.equal(fixed.status, 404);
      assert.equal(fixed.headers.get("Cache-Control"), "no-store");
      assert.equal(inits.length, 1);
      assert.equal(inits[0]?.status, 404);
      assert.equal(
        Object.prototype.hasOwnProperty.call(inits[0], "webSocket"),
        true,
      );
      assert.equal(inits[0]?.webSocket, null);
      assert.deepEqual(inits[0]?.cf, {
        cacheStatus: "MISS",
        neutroProbe: "asset-cache",
      });
    } finally {
      globalThis.Response = OriginalResponse;
    }
  });

  it("mutación: sin withAssetErrorCacheControl el 404 conserva immutable", () => {
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": IMMUTABLE },
    });
    assert.equal(upstream.headers.get("Cache-Control"), IMMUTABLE);
    assert.notEqual(upstream.headers.get("Cache-Control"), "no-store");
    const fixed = withAssetErrorCacheControl(
      upstream,
      "/_astro/old.CssHash.css",
    );
    assert.equal(fixed.headers.get("Cache-Control"), "no-store");
  });

  it("mutación: no-cache en vez de no-store debe fallar la aserción literal", () => {
    assert.equal(ASSET_ERROR_CACHE_CONTROL, "no-store");
    const mutated = "no-cache";
    assert.notEqual(ASSET_ERROR_CACHE_CONTROL, mutated);
    const upstream = new Response("missing", {
      status: 404,
      headers: { "cache-control": IMMUTABLE },
    });
    const fixed = withAssetErrorCacheControl(upstream, "/video/gone.mp4");
    assert.equal(fixed.headers.get("Cache-Control"), "no-store");
    assert.notEqual(fixed.headers.get("Cache-Control"), mutated);
  });

  it("mutación: includes en vez de startsWith marcaría /x/images/x y /x/og/x", () => {
    for (const path of ["/x/images/x", "/x/og/x"] as const) {
      assert.equal(isLongCacheAssetPath(path), false);
      const includesMatch = LONG_CACHE_ASSET_PREFIXES.some((prefix) =>
        path.includes(prefix),
      );
      assert.equal(includesMatch, true);
      assert.notEqual(isLongCacheAssetPath(path), includesMatch);
    }
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
    assert.equal(fixed.headers.get("Cache-Control"), "no-store");
    assert.notEqual(isCacheableAssetStatus(404), wrongAllowlist.has(404));
  });
});

describe("Worker: 404 bajo assets con Cache-Control propio", () => {
  for (const path of [
    "/_astro/no-existe-seo07.bin",
    "/images/no-existe-seo07.bin",
    "/video/no-existe-seo07.bin",
    "/og/no-existe-seo07.bin",
    "/favicon.ico",
    "/site.webmanifest",
  ] as const) {
    it(`sirve 404 GET de ${path} con no-store y cabeceras de seguridad`, async () => {
      const { calls, env } = assetEnv(404, "missing", {
        "content-type": "text/html; charset=utf-8",
        "cache-control": IMMUTABLE,
      });
      const response = await fetchWorker(`${PRODUCTION}${path}`, env);
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
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

    it(`sirve 404 HEAD de ${path} con no-store`, async () => {
      const { env } = assetEnv(404, "missing", {
        "content-type": "text/html; charset=utf-8",
        "cache-control": IMMUTABLE,
      });
      const response = await fetchWorker(`${PRODUCTION}${path}`, env, {
        method: "HEAD",
      });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    });
  }

  it("conserva immutable en 200 GET y HEAD de /_astro/*", async () => {
    for (const method of ["GET", "HEAD"] as const) {
      const { env } = assetEnv(200, "body{}", {
        "content-type": "text/css",
        "cache-control": IMMUTABLE,
      });
      const response = await fetchWorker(
        `${PRODUCTION}/_astro/base.CssHash.css`,
        env,
        { method },
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), IMMUTABLE);
      assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
      assert.equal(response.headers.get("X-Robots-Tag"), null);
    }
  });

  it("conserva max-age=3600 sin SWR en 200 de /images y /og", async () => {
    for (const path of ["/images/work/x.webp", "/og/og-1200x630.png"] as const) {
      const { env } = assetEnv(200, "bin", {
        "content-type": "image/webp",
        "cache-control": HOUR,
      });
      const response = await fetchWorker(`${PRODUCTION}${path}`, env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600");
      assert.equal(
        response.headers.get("Cache-Control")?.includes("stale-while-revalidate"),
        false,
      );
      assert.notEqual(
        response.headers.get("Cache-Control"),
        "public, max-age=86400",
      );
    }
  });

  it("no reescribe 404 HTML de páginas", async () => {
    const { calls, env } = assetEnv(404, "not found", {
      "content-type": "text/html; charset=utf-8",
      "cache-control": HTML_DEFAULT,
    });
    const response = await fetchWorker(`${PRODUCTION}/no-existe-seo07`, env);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Cache-Control"), HTML_DEFAULT);
    assert.notEqual(response.headers.get("Cache-Control"), "no-store");
    assert.equal(calls.length, 1);
  });

  it("no aplica el wrapper a /ingest", async () => {
    const { calls, env } = assetEnv(200, "unused", {
      "content-type": "text/plain",
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("array", {
        status: 200,
        headers: {
          "content-type": "application/javascript",
          "cache-control": "public, max-age=14400",
          "access-control-allow-origin": "*",
        },
      })) as typeof fetch;
    try {
      const response = await fetchWorker(
        `${PRODUCTION}/ingest/static/array.js`,
        env,
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("Cache-Control"),
        "public, max-age=14400",
      );
      assert.notEqual(response.headers.get("Cache-Control"), "no-store");
      assert.equal(response.headers.get("access-control-allow-origin"), "*");
      assert.deepEqual(calls, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
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
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Strict-Transport-Security"), null);
  });

  it("mutación: el wrapper solo envuelve env.ASSETS.fetch en index.ts", () => {
    assert.match(
      INDEX_SOURCE,
      /return respond\(\s*withAssetErrorCacheControl\(\s*await env\.ASSETS\.fetch\(request\),\s*url\.pathname,\s*\),\s*url\.hostname,\s*\);/,
    );
    assert.equal(
      [...INDEX_SOURCE.matchAll(/withAssetErrorCacheControl/g)].length,
      2,
    );
    assert.doesNotMatch(
      INDEX_SOURCE,
      /withAssetErrorCacheControl\(\s*await proxyPosthogIngest/,
    );
    assert.doesNotMatch(
      INDEX_SOURCE,
      /withAssetErrorCacheControl\(\s*createQrRedirectResponse/,
    );
    assert.doesNotMatch(INDEX_SOURCE, /withAssetErrorCacheControl\(\s*slash/);
    const respondFn = INDEX_SOURCE.slice(
      INDEX_SOURCE.indexOf("function respond("),
      INDEX_SOURCE.indexOf("export default"),
    );
    assert.doesNotMatch(respondFn, /withAssetErrorCacheControl/);
    const ingestBranch = INDEX_SOURCE.slice(
      INDEX_SOURCE.indexOf("if (isPosthogIngestPath"),
      INDEX_SOURCE.indexOf("const redirect = resolveQrRedirect"),
    );
    assert.doesNotMatch(ingestBranch, /withAssetErrorCacheControl/);
  });

  it("mutación: solo-GET fallaría porque HEAD también recibe no-store", async () => {
    const { env } = assetEnv(404, "missing", {
      "content-type": "text/html; charset=utf-8",
      "cache-control": IMMUTABLE,
    });
    const getResponse = await fetchWorker(
      `${PRODUCTION}/og/gone.png`,
      env,
      { method: "GET" },
    );
    const headResponse = await fetchWorker(
      `${PRODUCTION}/og/gone.png`,
      env,
      { method: "HEAD" },
    );
    assert.equal(getResponse.headers.get("Cache-Control"), "no-store");
    assert.equal(headResponse.headers.get("Cache-Control"), "no-store");
  });
});
