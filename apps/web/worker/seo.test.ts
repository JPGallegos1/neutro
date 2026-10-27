import assert from "node:assert/strict";
import { describe, it } from "node:test";

import worker, { isWorkersDevHost } from "./index.ts";
import { isHstsHost, withSecurityHeaders } from "./security-headers.ts";

const WORKERS_DEV = "https://neutro-web.jpgallegos20.workers.dev";
const PRODUCTION = "https://neutro.solutions";
const PRODUCTION_WWW = "https://www.neutro.solutions";
const LOCALHOST = "http://localhost:8787";

const EXPECTED_X_CONTENT_TYPE_OPTIONS = "nosniff";
const EXPECTED_REFERRER_POLICY = "strict-origin-when-cross-origin";
const EXPECTED_PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";
const EXPECTED_X_FRAME_OPTIONS = "DENY";
const EXPECTED_HSTS = "max-age=300";
const EXPECTED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;
const EXPECTED_CSP_REPORT_ONLY = EXPECTED_CSP_DIRECTIVES.join("; ");

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

const EXPECTED_SIMPLE_SECURITY_HEADERS = {
  "X-Content-Type-Options": EXPECTED_X_CONTENT_TYPE_OPTIONS,
  "Referrer-Policy": EXPECTED_REFERRER_POLICY,
  "Permissions-Policy": EXPECTED_PERMISSIONS_POLICY,
  "X-Frame-Options": EXPECTED_X_FRAME_OPTIONS,
} as const;

function assertSimpleSecurityHeaders(response: Response): void {
  for (const [name, value] of Object.entries(
    EXPECTED_SIMPLE_SECURITY_HEADERS,
  )) {
    assert.equal(response.headers.get(name), value, `missing or wrong ${name}`);
  }
}

function assertCspReportOnly(response: Response): void {
  const csp = response.headers.get("Content-Security-Policy-Report-Only");
  assert.equal(csp, EXPECTED_CSP_REPORT_ONLY);
  for (const directive of EXPECTED_CSP_DIRECTIVES) {
    assert.equal(
      csp?.includes(directive) ?? false,
      true,
      `CSP missing directive: ${directive}`,
    );
  }
  assert.equal(response.headers.get("Content-Security-Policy"), null);
}

function assertNoCsp(response: Response): void {
  assert.equal(response.headers.get("Content-Security-Policy"), null);
  assert.equal(
    response.headers.get("Content-Security-Policy-Report-Only"),
    null,
  );
}

function assertHstsProduction(response: Response): void {
  const hsts = response.headers.get("Strict-Transport-Security");
  assert.equal(hsts, EXPECTED_HSTS);
  assert.equal(hsts?.includes("includeSubDomains"), false);
  assert.equal(hsts?.includes("preload"), false);
  assert.match(hsts ?? "", /^max-age=300$/);
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
  it("applies exact expected simple headers and every CSP directive on HTML", async () => {
    const { env } = typedAssetEnv(
      200,
      "<html>home</html>",
      "text/html; charset=utf-8",
      { "cache-control": "public, max-age=0, must-revalidate" },
    );
    const response = await fetchWorker(`${PRODUCTION}/`, env);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      response.headers.get("Referrer-Policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(
      response.headers.get("Permissions-Policy"),
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    );
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertCspReportOnly(response);
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
    assertNoCsp(response);
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
    assertNoCsp(response);
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
    assertNoCsp(response);
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
      assertNoCsp(response);
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
    assertCspReportOnly(response);
  });

  it("sets HSTS only on apex and www, including uppercase host and explicit port", async () => {
    const allowed = [
      `${PRODUCTION}/`,
      `${PRODUCTION_WWW}/`,
      "https://NEUTRO.SOLUTIONS/",
      "https://WWW.NEUTRO.SOLUTIONS/",
      "https://neutro.solutions:443/",
      "https://www.neutro.solutions:443/",
    ];
    for (const url of allowed) {
      const response = await fetchWorker(
        url,
        typedAssetEnv(200, "ok", "text/html; charset=utf-8").env,
      );
      assertHstsProduction(response);
      assertSimpleSecurityHeaders(response);
    }

    assert.equal(isHstsHost("neutro.solutions"), true);
    assert.equal(isHstsHost("www.neutro.solutions"), true);
    assert.equal(isHstsHost("NEUTRO.SOLUTIONS"), true);
    assert.equal(isHstsHost("WWW.NEUTRO.SOLUTIONS"), true);
  });

  it("omits HSTS on lookalike hosts, workers.dev and localhost", async () => {
    const denied = [
      "https://neutro.solutions.evil.com/",
      "https://evilneutro.solutions/",
      "https://workers.dev/",
      WORKERS_DEV + "/",
      LOCALHOST + "/",
      "http://localhost/",
      "https://localhost/",
      "https://notneutro.solutions/",
      "https://neutro.solutions.attacker.test/",
    ];
    for (const url of denied) {
      const response = await fetchWorker(
        url,
        typedAssetEnv(200, "ok", "text/html; charset=utf-8").env,
      );
      assertNoHsts(response);
      assertSimpleSecurityHeaders(response);
    }

    assert.equal(isHstsHost("neutro.solutions.evil.com"), false);
    assert.equal(isHstsHost("evilneutro.solutions"), false);
    assert.equal(isHstsHost("workers.dev"), false);
    assert.equal(isHstsHost("localhost"), false);
    assert.equal(isHstsHost("neutro-web.jpgallegos20.workers.dev"), false);
  });

  it("overwrites weaker upstream security headers with set", async () => {
    const { env } = typedAssetEnv(200, "<html>x</html>", "text/html", {
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(self)",
      "x-content-type-options": "nosniff ",
      "content-security-policy": "default-src 'none'",
      "content-security-policy-report-only": "default-src 'none'",
      "strict-transport-security":
        "max-age=31536000; includeSubDomains; preload",
    });
    const response = await fetchWorker(`${PRODUCTION}/`, env);

    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assert.equal(
      response.headers.get("Referrer-Policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(
      response.headers.get("Permissions-Policy"),
      EXPECTED_PERMISSIONS_POLICY,
    );
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      response.headers.get("Strict-Transport-Security"),
      EXPECTED_HSTS,
    );
    assertCspReportOnly(response);
    assert.equal(response.headers.get("Content-Security-Policy"), null);
  });

  it("preserves 206 Partial Content status, Content-Range and body", async () => {
    const body = "0123456789";
    const env = {
      ASSETS: {
        fetch: async (input: RequestInfo | URL) => {
          const request = input instanceof Request ? input : new Request(input);
          const range = request.headers.get("Range");
          assert.equal(range, "bytes=0-3");
          return new Response(body.slice(0, 4), {
            status: 206,
            statusText: "Partial Content",
            headers: {
              "content-type": "video/mp4",
              "content-range": "bytes 0-3/10",
              "accept-ranges": "bytes",
              "x-frame-options": "SAMEORIGIN",
            },
          });
        },
      },
    };
    const response = await worker.fetch(
      new Request(`${PRODUCTION}/video/neutro.mp4`, {
        headers: { Range: "bytes=0-3" },
      }),
      env as unknown as Parameters<typeof worker.fetch>[1],
      executionContext(),
    );

    assert.equal(response.status, 206);
    assert.equal(response.statusText, "Partial Content");
    assert.equal(response.headers.get("content-range"), "bytes 0-3/10");
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(response.headers.get("X-Frame-Options"), "DENY");
    assertSimpleSecurityHeaders(response);
    assertHstsProduction(response);
    assertNoCsp(response);
    assert.equal(await response.text(), "0123");
  });

  it("passes webSocket and cf into Response init when rebuilding", () => {
    const upstream = new Response("body", { status: 200 });
    Object.defineProperty(upstream, "webSocket", {
      value: null,
      configurable: true,
    });
    Object.defineProperty(upstream, "cf", {
      value: { cacheStatus: "HIT", neutroProbe: "seo10" },
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
      const wrapped = withSecurityHeaders(upstream, "neutro.solutions");
      assert.equal(wrapped.status, 200);
      assert.equal(inits.length, 1);
      assert.equal(inits[0]?.status, 200);
      assert.equal(inits[0]?.webSocket, null);
      assert.deepEqual(inits[0]?.cf, {
        cacheStatus: "HIT",
        neutroProbe: "seo10",
      });
      assert.equal(
        new Headers(inits[0]?.headers).get("X-Frame-Options"),
        "DENY",
      );
      assert.equal(
        new Headers(inits[0]?.headers).get("Strict-Transport-Security"),
        EXPECTED_HSTS,
      );
    } finally {
      globalThis.Response = OriginalResponse;
    }
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
      assert.equal(response.headers.get("Content-Security-Policy"), null);
      assertSimpleSecurityHeaders(response);
    }
  });
});
