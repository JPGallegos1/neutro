import assert from "node:assert/strict";
import { describe, it } from "node:test";

import worker, { isWorkersDevHost } from "./index.ts";
import {
  CSP_REPORT_ONLY,
  HSTS_MAX_AGE_SECONDS,
  HSTS_VALUE,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
  X_CONTENT_TYPE_OPTIONS,
  X_FRAME_OPTIONS,
  isHstsHost,
} from "./security-headers.ts";

const WORKERS_DEV = "https://neutro-web.jpgallegos20.workers.dev";
const PRODUCTION = "https://neutro.solutions";
const PRODUCTION_WWW = "https://www.neutro.solutions";
const LOCALHOST = "http://localhost:8787";

function executionContext(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;
}

function assetEnv(body = "page") {
  const calls: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        calls.push(url);
        return new Response(body, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
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

describe("isWorkersDevHost", () => {
  it("matches workers.dev and its subdomains only", () => {
    assert.equal(isWorkersDevHost("workers.dev"), true);
    assert.equal(isWorkersDevHost("neutro-web.jpgallegos20.workers.dev"), true);
    assert.equal(isWorkersDevHost("neutro.solutions"), false);
    assert.equal(isWorkersDevHost("notworkers.dev"), false);
    assert.equal(isWorkersDevHost("workers.dev.example"), false);
  });
});

describe("X-Robots-Tag", () => {
  it("sets noindex on workers.dev, including asset responses", async () => {
    const { calls, env } = assetEnv("asset");
    const response = await fetchWorker(`${WORKERS_DEV}/favicon.svg`, env);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(
      response.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    assert.equal(await response.text(), "asset");
    assert.equal(calls.length, 1);
  });

  it("omits the header on neutro.solutions", async () => {
    const { env } = assetEnv("home");
    const response = await fetchWorker(`${PRODUCTION}/`, env);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Robots-Tag"), null);
    assert.equal(await response.text(), "home");
  });

  it("sets noindex on the ingest proxy response for workers.dev", async () => {
    const { calls, env } = assetEnv("unused");
    const originalFetch = globalThis.fetch;
    const upstream: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      upstream.push(String(input));
      return new Response("ok", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "a=1",
        },
      });
    }) as typeof fetch;
    try {
      const response = await fetchWorker(`${WORKERS_DEV}/ingest/e/?ip=0`, env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(response.headers.get("content-type"), "application/json");
      assert.equal(await response.text(), "ok");
      assert.deepEqual(upstream, ["https://eu.i.posthog.com/e/?ip=0"]);
      assert.deepEqual(calls, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("static brand assets", () => {
  const paths = [
    "/favicon.ico",
    "/favicon.svg",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/apple-touch-icon.png",
    "/icon-192.png",
    "/icon-512.png",
    "/site.webmanifest",
    "/og/og-1200x630.png",
    "/og/x-1200x675.png",
  ];

  function contentType(pathname: string): string {
    if (pathname.endsWith(".svg")) {
      return "image/svg+xml";
    }
    if (pathname.endsWith(".png")) {
      return "image/png";
    }
    if (pathname.endsWith(".ico")) {
      return "image/x-icon";
    }
    if (pathname.endsWith(".webmanifest")) {
      return "application/manifest+json";
    }
    return "application/octet-stream";
  }

  function brandAssetEnv() {
    const calls: string[] = [];
    const env = {
      ASSETS: {
        fetch: async (input: RequestInfo | URL) => {
          const url = input instanceof Request ? input.url : String(input);
          calls.push(url);
          const pathname = new URL(url).pathname;
          return new Response(pathname, {
            status: 200,
            headers: { "content-type": contentType(pathname) },
          });
        },
      },
    };
    return { calls, env };
  }

  for (const pathname of paths) {
    it(`serves ${pathname} from assets on production and workers.dev`, async () => {
      for (const origin of [PRODUCTION, WORKERS_DEV]) {
        const { calls, env } = brandAssetEnv();
        const response = await fetchWorker(`${origin}${pathname}`, env);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get("Location"), null);
        assert.equal(
          response.headers.get("content-type"),
          contentType(pathname),
        );
        assert.equal(
          response.headers.get("X-Robots-Tag"),
          origin === WORKERS_DEV ? "noindex" : null,
        );
        assert.equal(await response.text(), pathname);
        assert.deepEqual(calls, [`${origin}${pathname}`]);
      }
    });
  }
});

describe("trailing slash", () => {
  it("redirects /nosotros/ to /nosotros with 301 and an empty body", async () => {
    const { calls, env } = assetEnv("<html>nosotros</html>");
    const response = await fetchWorker(`${PRODUCTION}/nosotros/?lang=es`, env);

    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("Location"),
      `${PRODUCTION}/nosotros?lang=es`,
    );
    assert.equal(response.headers.get("X-Robots-Tag"), null);
    assert.equal(await response.text(), "");
    assert.deepEqual(calls, []);
  });

  it("adds noindex to that redirect on workers.dev", async () => {
    const { calls, env } = assetEnv("ignored");
    const response = await fetchWorker(`${WORKERS_DEV}/nosotros/`, env);

    assert.equal(response.status, 301);
    assert.equal(response.headers.get("Location"), `${WORKERS_DEV}/nosotros`);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.deepEqual(calls, []);
  });

  it("serves /nosotros from assets without duplicating the slashed url", async () => {
    const { calls, env } = assetEnv("nosotros");
    const response = await fetchWorker(`${PRODUCTION}/nosotros`, env);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "nosotros");
    assert.equal(calls.length, 1);
  });

  it("leaves the home path and reserved worker paths alone", async () => {
    const home = assetEnv("home");
    const homeResponse = await fetchWorker(`${PRODUCTION}/`, home.env);
    assert.equal(homeResponse.status, 200);
    assert.deepEqual(home.calls, [`${PRODUCTION}/`]);

    const ingest = assetEnv("ingest");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("proxied", {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    try {
      const ingestResponse = await fetchWorker(
        `${PRODUCTION}/ingest/`,
        ingest.env,
      );
      assert.equal(ingestResponse.status, 200);
      assert.equal(ingestResponse.headers.get("Location"), null);
      assert.equal(ingestResponse.headers.get("X-Robots-Tag"), null);
      assert.equal(await ingestResponse.text(), "proxied");
      assert.deepEqual(ingest.calls, []);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const qr = assetEnv("unused");
    const qrResponse = await fetchWorker(`${PRODUCTION}/f/1/`, qr.env);
    assert.equal(qrResponse.status, 302);
    assert.equal(qrResponse.headers.get("X-Robots-Tag"), "noindex");
    assert.match(
      qrResponse.headers.get("Location") ?? "",
      /^https:\/\/neutro\.solutions\/\?/,
    );
    assert.deepEqual(qr.calls, []);
  });
});

const SIMPLE_SECURITY_HEADERS = {
  "X-Content-Type-Options": X_CONTENT_TYPE_OPTIONS,
  "Referrer-Policy": REFERRER_POLICY,
  "Permissions-Policy": PERMISSIONS_POLICY,
  "X-Frame-Options": X_FRAME_OPTIONS,
} as const;

function assertSimpleSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(SIMPLE_SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value, `missing or wrong ${name}`);
  }
}

function assertNoCspEnforce(response: Response): void {
  assert.equal(response.headers.get("Content-Security-Policy"), null);
}

function assertHstsProduction(response: Response): void {
  const hsts = response.headers.get("Strict-Transport-Security");
  assert.equal(hsts, HSTS_VALUE);
  assert.equal(hsts?.includes("includeSubDomains"), false);
  assert.equal(hsts?.includes("preload"), false);
  assert.match(hsts ?? "", /^max-age=300$/);
  assert.equal(HSTS_MAX_AGE_SECONDS, 300);
  assert.equal(HSTS_MAX_AGE_SECONDS > 300, false);
}

function assertNoHsts(response: Response): void {
  assert.equal(response.headers.get("Strict-Transport-Security"), null);
}

function typedAssetEnv(
  status: number,
  body: string,
  contentType: string,
  extraHeaders: Record<string, string> = {},
) {
  const calls: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        calls.push(url);
        return new Response(body, {
          status,
          headers: { "content-type": contentType, ...extraHeaders },
        });
      },
    },
  };
  return { calls, env };
}

describe("SEO-10 security headers", () => {
  it("exports HSTS step-1 values without includeSubDomains or preload", () => {
    assert.equal(HSTS_VALUE, "max-age=300");
    assert.equal(HSTS_MAX_AGE_SECONDS, 300);
    assert.equal(HSTS_VALUE.includes("includeSubDomains"), false);
    assert.equal(HSTS_VALUE.includes("preload"), false);
    assert.equal(isHstsHost("neutro.solutions"), true);
    assert.equal(isHstsHost("www.neutro.solutions"), true);
    assert.equal(isHstsHost("neutro-web.jpgallegos20.workers.dev"), false);
    assert.equal(isHstsHost("localhost"), false);
  });

  it("applies simple headers and HSTS to HTML assets on production", async () => {
    const { env } = typedAssetEnv(
      200,
      "<html>home</html>",
      "text/html; charset=utf-8",
      { "cache-control": "public, max-age=0, must-revalidate" },
    );
    const response = await fetchWorker(`${PRODUCTION}/`, env);

    assert.equal(response.status, 200);
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertNoCspEnforce(response);
    assert.equal(
      response.headers.get("Content-Security-Policy-Report-Only"),
      CSP_REPORT_ONLY,
    );
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=0, must-revalidate",
    );
  });

  it("applies simple headers to hashed CSS assets without CSP", async () => {
    const { env } = typedAssetEnv(200, "body{}", "text/css", {
      "cache-control": "public, max-age=0, must-revalidate",
    });
    const response = await fetchWorker(
      `${PRODUCTION}/_astro/base.example.css`,
      env,
    );

    assert.equal(response.status, 200);
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertNoCspEnforce(response);
    assert.equal(
      response.headers.get("Content-Security-Policy-Report-Only"),
      null,
    );
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=0, must-revalidate",
    );
  });

  it("applies simple headers to trailing-slash 301 redirects", async () => {
    const { calls, env } = assetEnv("ignored");
    const response = await fetchWorker(`${PRODUCTION}/trabajo/`, env);

    assert.equal(response.status, 301);
    assert.equal(response.headers.get("Location"), `${PRODUCTION}/trabajo`);
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertNoCspEnforce(response);
    assert.equal(
      response.headers.get("Content-Security-Policy-Report-Only"),
      null,
    );
    assert.deepEqual(calls, []);
  });

  it("applies simple headers to /f/N 302 without changing Cache-Control", async () => {
    const { calls, env } = assetEnv("unused");
    const response = await fetchWorker(`${PRODUCTION}/f/999`, env);

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${PRODUCTION}/`);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Cloudflare-CDN-Cache-Control"),
      "no-store",
    );
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertNoCspEnforce(response);
    assert.equal(
      response.headers.get("Content-Security-Policy-Report-Only"),
      null,
    );
    assert.deepEqual(calls, []);
  });

  it("applies simple headers to /ingest without changing Cache-Control or CORS", async () => {
    const { calls, env } = assetEnv("unused");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("array", {
        status: 200,
        headers: {
          "content-type": "application/javascript",
          "cache-control": "public, max-age=14400",
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        },
      })) as typeof fetch;
    try {
      const response = await fetchWorker(
        `${PRODUCTION}/ingest/static/array.js`,
        env,
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get("cache-control"),
        "public, max-age=14400",
      );
      assert.equal(response.headers.get("access-control-allow-origin"), "*");
      assert.equal(
        response.headers.get("access-control-allow-methods"),
        "GET, POST, OPTIONS",
      );
      assertSimpleSecurityHeaders(response);
      assertHstsProduction(response);
      assertNoCspEnforce(response);
      assert.equal(
        response.headers.get("Content-Security-Policy-Report-Only"),
        null,
      );
      assert.deepEqual(calls, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("applies simple headers and CSP Report-Only to HTML 404", async () => {
    const { env } = typedAssetEnv(
      404,
      "<html>404</html>",
      "text/html; charset=utf-8",
    );
    const response = await fetchWorker(`${PRODUCTION}/no-existe-x`, env);

    assert.equal(response.status, 404);
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertNoCspEnforce(response);
    assert.equal(
      response.headers.get("Content-Security-Policy-Report-Only"),
      CSP_REPORT_ONLY,
    );
  });

  it("sets HSTS on www.neutro.solutions and omits it on workers.dev and localhost", async () => {
    const www = await fetchWorker(
      `${PRODUCTION_WWW}/`,
      typedAssetEnv(200, "www", "text/html; charset=utf-8").env,
    );
    assertHstsProduction(www);
    assertSimpleSecurityHeaders(www);

    const workers = await fetchWorker(
      `${WORKERS_DEV}/`,
      typedAssetEnv(200, "dev", "text/html; charset=utf-8").env,
    );
    assertNoHsts(workers);
    assertSimpleSecurityHeaders(workers);
    assert.equal(workers.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(
      workers.headers.get("Content-Security-Policy-Report-Only"),
      CSP_REPORT_ONLY,
    );
    assertNoCspEnforce(workers);

    const local = await fetchWorker(
      `${LOCALHOST}/`,
      typedAssetEnv(200, "local", "text/html; charset=utf-8").env,
    );
    assertNoHsts(local);
    assertSimpleSecurityHeaders(local);
    assertNoCspEnforce(local);
  });

  it("never emits Content-Security-Policy enforce on any response type", async () => {
    const cases: Array<() => Promise<Response>> = [
      () =>
        fetchWorker(
          `${PRODUCTION}/`,
          typedAssetEnv(200, "<html/>", "text/html").env,
        ),
      () =>
        fetchWorker(
          `${PRODUCTION}/_astro/x.css`,
          typedAssetEnv(200, "x", "text/css").env,
        ),
      () => fetchWorker(`${PRODUCTION}/trabajo/`, assetEnv().env),
      () => fetchWorker(`${PRODUCTION}/f/999`, assetEnv().env),
      async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () =>
          new Response("ok", {
            status: 200,
            headers: { "content-type": "application/json" },
          })) as typeof fetch;
        try {
          return await fetchWorker(`${PRODUCTION}/ingest/e/`, assetEnv().env);
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
      () =>
        fetchWorker(
          `${PRODUCTION}/missing`,
          typedAssetEnv(404, "<html>404</html>", "text/html").env,
        ),
    ];

    for (const run of cases) {
      const response = await run();
      assertNoCspEnforce(response);
      assertSimpleSecurityHeaders(response);
    }
  });
});
