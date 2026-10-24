import assert from "node:assert/strict";
import { describe, it } from "node:test";

import worker, { isWorkersDevHost } from "./index.ts";

const WORKERS_DEV = "https://neutro-web.jpgallegos20.workers.dev";
const PRODUCTION = "https://neutro.solutions";

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
