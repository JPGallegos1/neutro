import assert from "node:assert/strict";
import { describe, it } from "node:test";

import worker, { isWorkersDevHost } from "./index.ts";

const WORKERS_DEV = "https://neutro-web.jpgallegos20.workers.dev";
const PRODUCTION = "https://neutro.solutions";

function executionContext(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as ExecutionContext;
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
    env as Parameters<typeof worker.fetch>[1],
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
    const ingestResponse = await fetchWorker(
      `${PRODUCTION}/ingest/`,
      ingest.env,
    );
    assert.equal(ingestResponse.status, 200);
    assert.deepEqual(ingest.calls, [`${PRODUCTION}/ingest/`]);

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
