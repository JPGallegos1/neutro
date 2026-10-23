import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POSTHOG_EU_API_HOST,
  POSTHOG_EU_ASSET_HOST,
  POSTHOG_EU_CAPTURE,
  buildQrCapturePayload,
  captureAck,
  captureQrScanned,
  isPosthogIngestPath,
  isServerAnalyticsEnabled,
  proxyPosthogIngest,
  type PosthogAssetCache,
} from "./posthog.ts";

async function withCapturedLogs(
  run: (logs: string[]) => Promise<void>,
): Promise<void> {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    await run(logs);
  } finally {
    console.log = original;
  }
}

const event = {
  slug: "2048",
  id: "1",
  source: "flyer",
  campaign: "calle-oct26",
};

const ids = {
  eventId: "11111111-1111-4111-8111-111111111111",
  distinctId: "22222222-2222-4222-8222-222222222222",
  timestamp: "2026-10-21T15:11:42.000Z",
};

describe("buildQrCapturePayload", () => {
  it("keeps identity, dedupe id, and timestamp apart", () => {
    const payload = buildQrCapturePayload("phc_test", event, ids);

    assert.equal(payload.event, "qr_scanned");
    assert.equal(payload.uuid, ids.eventId);
    assert.equal(payload.distinct_id, ids.distinctId);
    assert.notEqual(payload.uuid, payload.distinct_id);
    assert.equal(payload.timestamp, ids.timestamp);
    assert.equal(payload.sent_at, ids.timestamp);
    assert.match(
      payload.timestamp,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    assert.equal(typeof payload.timestamp, "string");
  });

  it("stays cookieless and does not send an IP", () => {
    const payload = buildQrCapturePayload("phc_test", event, ids);

    assert.equal(payload.properties.$process_person_profile, false);
    assert.equal(payload.properties.$geoip_disable, true);
    assert.equal(payload.properties.$lib, "neutro-web-worker");
    assert.equal("$ip" in payload.properties, false);
    assert.deepEqual(
      {
        slug: payload.properties.slug,
        id: payload.properties.id,
        source: payload.properties.source,
        campaign: payload.properties.campaign,
      },
      event,
    );
  });
});

describe("captureAck", () => {
  it("accepts only a 2xx body whose parsed status is Ok", () => {
    assert.equal(captureAck(200, '{"status":"Ok"}'), "accepted");
    assert.equal(captureAck(201, ' {"status":"Ok"} '), "accepted");
    assert.equal(captureAck(200, ""), "rejected");
    assert.equal(captureAck(200, "not json"), "rejected");
    assert.equal(captureAck(200, '{"status":"Ok"'), "rejected");
    assert.equal(
      captureAck(200, '{"status":"Error","detail":"Ok is not the status"}'),
      "rejected",
    );
    assert.equal(captureAck(401, "nope"), "rejected");
    assert.equal(captureAck(302, '{"status":"Ok"}'), "rejected");
    assert.equal(captureAck(500, '{"status":"Ok"}'), "rejected");
  });
});

describe("captureQrScanned", () => {
  it("posts to the EU capture host, drains the body, and does not log the key", async () => {
    const apiKey = "phc_test_secret_value";
    let reads = 0;
    const calls: Array<{ url: string; init: RequestInit }> = [];

    await withCapturedLogs(async (logs) => {
      await captureQrScanned(apiKey, event, (async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        const response = new Response('{"status":"Ok"}', { status: 200 });
        const read = response.text.bind(response);
        response.text = async () => {
          reads += 1;
          return read();
        };
        return response;
      }) as typeof fetch);

      assert.equal(logs.length, 1);
      assert.match(logs[0] ?? "", /^posthog_capture_accepted /);
      assert.equal(
        logs.some((line) => line.includes(apiKey)),
        false,
      );
      assert.equal(
        logs.some((line) => line.includes("phc_")),
        false,
      );
    });

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, POSTHOG_EU_CAPTURE);
    assert.equal(call.url.includes("us.i.posthog.com"), false);
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.redirect, "manual");

    const body = JSON.parse(String(call.init.body));
    assert.equal(body.api_key, apiKey);
    assert.equal(body.event, "qr_scanned");
    assert.notEqual(body.uuid, body.distinct_id);
    assert.equal(body.properties.$geoip_disable, true);
    assert.equal(body.properties.$process_person_profile, false);
    assert.equal(Object.hasOwn(body.properties, "$ip"), false);
    assert.match(body.timestamp, /Z$/);
    assert.equal(typeof body.timestamp, "string");
    assert.equal(reads, 1);
  });

  it("logs a rejection when capture does not ack, without throwing", async () => {
    await withCapturedLogs(async (logs) => {
      await captureQrScanned(
        "phc_test_secret_value",
        event,
        (async () =>
          new Response("upstream down", { status: 503 })) as typeof fetch,
      );
      assert.match(logs[0] ?? "", /^posthog_capture_rejected /);
      assert.match(logs[0] ?? "", /"status":503/);
    });
  });

  it("redacts a key embedded in the response body", async () => {
    const apiKey = "phc_fake_review_only";
    await withCapturedLogs(async (logs) => {
      await captureQrScanned(
        apiKey,
        event,
        (async () =>
          new Response(
            `{"error":"Invalid key: ${apiKey} and phc_otherToken999"}`,
            { status: 401 },
          )) as typeof fetch,
      );
      const line = logs[0] ?? "";
      assert.match(line, /^posthog_capture_rejected /);
      assert.equal(line.includes(apiKey), false);
      assert.equal(line.includes("phc_"), false);
      assert.match(line, /\[redacted\]/);
    });
  });

  it("swallows fetch failures so the redirect is not blocked", async () => {
    await withCapturedLogs(async (logs) => {
      await captureQrScanned("phc_test_secret_value", event, (async () => {
        throw new Error("network down");
      }) as typeof fetch);
      assert.match(logs[0] ?? "", /^posthog_capture_error /);
      assert.match(logs[0] ?? "", /network down/);
      assert.equal(
        logs.some((line) => line.includes("phc_test_secret_value")),
        false,
      );
    });
  });

  it("redacts a key embedded in the fetch error", async () => {
    const apiKey = "phc_fake_review_only";
    await withCapturedLogs(async (logs) => {
      await captureQrScanned(apiKey, event, (async () => {
        throw new Error(`network down ${apiKey}`);
      }) as typeof fetch);
      const line = logs[0] ?? "";
      assert.match(line, /^posthog_capture_error /);
      assert.match(line, /network down/);
      assert.equal(line.includes(apiKey), false);
      assert.equal(line.includes("phc_"), false);
      assert.match(line, /\[redacted\]/);
    });
  });
});

type FetchCall = {
  url: string;
  init: RequestInit;
};

function headerValue(
  headers: HeadersInit | undefined,
  name: string,
): string | null {
  return new Headers(headers).get(name);
}

function mockFetch(response: () => Response | Promise<Response>): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response();
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function memoryCache(): PosthogAssetCache & { urls: string[] } {
  const store = new Map<string, Response>();
  return {
    urls: [],
    async match(request) {
      const hit = store.get(request.url);
      return hit ? hit.clone() : undefined;
    },
    async put(request, response) {
      this.urls.push(request.url);
      store.set(request.url, response.clone());
    },
  };
}

describe("isPosthogIngestPath", () => {
  it("matches the proxy prefix and leaves the rest of the site alone", () => {
    assert.equal(isPosthogIngestPath("/ingest"), true);
    assert.equal(isPosthogIngestPath("/ingest/"), true);
    assert.equal(isPosthogIngestPath("/ingest/e/"), true);
    assert.equal(isPosthogIngestPath("/ingest/static/array.js"), true);
    assert.equal(isPosthogIngestPath("/f/1"), false);
    assert.equal(isPosthogIngestPath("/t"), false);
    assert.equal(isPosthogIngestPath("/"), false);
    assert.equal(isPosthogIngestPath("/ingesting"), false);
    assert.equal(isPosthogIngestPath("/ingest-extra"), false);
  });
});

describe("proxyPosthogIngest", () => {
  it("uses the same EU host as server-side capture", () => {
    assert.equal(POSTHOG_EU_API_HOST, "eu.i.posthog.com");
    assert.equal(POSTHOG_EU_ASSET_HOST, "eu-assets.i.posthog.com");
    assert.equal(new URL(POSTHOG_EU_CAPTURE).hostname, POSTHOG_EU_API_HOST);
    assert.equal(POSTHOG_EU_API_HOST.includes("us."), false);
    assert.equal(POSTHOG_EU_ASSET_HOST.includes("us-assets"), false);
  });

  it("forwards capture with method, query, body, content-type, and client IP", async () => {
    const payload = JSON.stringify({
      api_key: "phc_test",
      event: "pageview",
    });
    const { fetchImpl, calls } = mockFetch(
      () =>
        new Response('{"status":"Ok"}', {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=60",
            "set-cookie": "ph_session=1; Path=/",
          },
        }),
    );

    const response = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/i/v0/e/?ip=0", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "session=secret",
          authorization: "Bearer secret",
          "x-forwarded-for": "1.2.3.4",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: payload,
      }),
      { fetchImpl, cache: memoryCache() },
    );

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, `https://${POSTHOG_EU_API_HOST}/i/v0/e/?ip=0`);
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.redirect, "manual");
    assert.equal(call.init.cache, "no-store");
    assert.equal(headerValue(call.init.headers, "host"), POSTHOG_EU_API_HOST);
    assert.equal(
      headerValue(call.init.headers, "content-type"),
      "application/json",
    );
    assert.equal(headerValue(call.init.headers, "cookie"), null);
    assert.equal(headerValue(call.init.headers, "authorization"), null);
    assert.equal(
      headerValue(call.init.headers, "x-forwarded-for"),
      "203.0.113.10",
    );
    assert.equal(await new Response(call.init.body).text(), payload);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"status":"Ok"}');
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  });

  it("drops a spoofed X-Forwarded-For when Cloudflare has no client IP", async () => {
    const { fetchImpl, calls } = mockFetch(() => new Response("ok"));
    await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/e/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "1.2.3.4",
          "cf-connecting-ip": "not an ip",
        },
        body: "{}",
      }),
      { fetchImpl },
    );

    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, `https://${POSTHOG_EU_API_HOST}/e/`);
    assert.equal(headerValue(call.init.headers, "x-forwarded-for"), null);
  });

  it("routes static and array to the EU asset host and keeps the query", async () => {
    const { fetchImpl, calls } = mockFetch(
      () =>
        new Response("asset", {
          headers: { "cache-control": "public, max-age=3600" },
        }),
    );

    const staticResponse = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/static/array.js?v=1"),
      { fetchImpl, cache: null },
    );
    const arrayResponse = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/array/phc_test/config.js"),
      { fetchImpl, cache: null },
    );

    assert.equal(
      calls[0]?.url,
      `https://${POSTHOG_EU_ASSET_HOST}/static/array.js?v=1`,
    );
    assert.equal(calls[0]?.init.method, "GET");
    assert.equal(calls[0]?.init.cache, undefined);
    assert.equal(
      headerValue(calls[0]?.init.headers, "host"),
      POSTHOG_EU_ASSET_HOST,
    );
    assert.equal(
      staticResponse.headers.get("cache-control"),
      "public, max-age=3600",
    );
    assert.equal(
      calls[1]?.url,
      `https://${POSTHOG_EU_ASSET_HOST}/array/phc_test/config.js`,
    );
    assert.equal(arrayResponse.status, 200);
    assert.equal(calls[0]?.url.includes("us-assets"), false);
    assert.equal(calls[1]?.url.includes("us.i.posthog.com"), false);
  });

  it("caches a successful static GET and strips cookies from the cached response", async () => {
    let fetches = 0;
    const { fetchImpl } = mockFetch(() => {
      fetches += 1;
      return new Response("sdk", {
        headers: [
          ["content-type", "text/javascript"],
          ["cache-control", "public, max-age=3600"],
          ["set-cookie", "a=1; Path=/"],
          ["set-cookie", "b=2; Path=/"],
        ],
      });
    });
    const cache = memoryCache();
    const url = "https://neutro.solutions/ingest/static/array.js";

    const first = await proxyPosthogIngest(new Request(url), {
      fetchImpl,
      cache,
    });
    const second = await proxyPosthogIngest(new Request(url), {
      fetchImpl,
      cache,
    });

    assert.equal(fetches, 1);
    assert.equal(await first.text(), "sdk");
    assert.equal(await second.text(), "sdk");
    assert.equal(first.headers.get("set-cookie"), null);
    assert.equal(second.headers.get("set-cookie"), null);
    assert.equal(second.headers.get("content-type"), "text/javascript");
    assert.equal(second.headers.get("cache-control"), "public, max-age=3600");
    assert.deepEqual(cache.urls, [
      `https://${POSTHOG_EU_ASSET_HOST}/static/array.js`,
    ]);
  });

  it("does not cache capture or a failed static response", async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = mockFetch(
      () => new Response("nope", { status: 500 }),
    );

    await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/flags/?v=2"),
      { fetchImpl, cache },
    );
    await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/static/array.js"),
      { fetchImpl, cache },
    );
    await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/static/array.js"),
      { fetchImpl, cache },
    );

    assert.equal(calls.length, 3);
    assert.deepEqual(cache.urls, []);
    assert.equal(calls[0]?.init.cache, "no-store");
    assert.equal(calls[0]?.url, `https://${POSTHOG_EU_API_HOST}/flags/?v=2`);
  });

  it("forwards an upstream HTTP error without turning it into 502", async () => {
    const { fetchImpl } = mockFetch(
      () =>
        new Response("bad key", {
          status: 401,
          headers: { "set-cookie": "a=1" },
        }),
    );
    const response = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/e/", {
        method: "POST",
        body: "{}",
      }),
      { fetchImpl },
    );

    assert.equal(response.status, 401);
    assert.equal(await response.text(), "bad key");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("forwards OPTIONS and rejects every other method", async () => {
    const { fetchImpl, calls } = mockFetch(
      () => new Response(null, { status: 204 }),
    );
    const options = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/e/", { method: "OPTIONS" }),
      { fetchImpl },
    );
    assert.equal(options.status, 204);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init.method, "OPTIONS");

    for (const method of ["PUT", "PATCH", "DELETE", "HEAD"]) {
      const response = await proxyPosthogIngest(
        new Request("https://neutro.solutions/ingest/e/", { method }),
        { fetchImpl },
      );
      assert.equal(response.status, 405);
      assert.equal(response.headers.get("allow"), "GET, POST, OPTIONS");
    }
    assert.equal(calls.length, 1);
  });

  it("returns 400 when the path escapes the PostHog host", async () => {
    const { fetchImpl, calls } = mockFetch(() => new Response("nope"));
    const paths = [
      "/ingest//evil.com/e/",
      "/ingest/\\evil.com/",
      "/ingest/static/..%2f..%2fevil",
    ];
    for (const path of paths) {
      const response = await proxyPosthogIngest(
        new Request(`https://neutro.solutions${path}`),
        { fetchImpl },
      );
      assert.equal(response.status, 400, path);
    }
    assert.equal(calls.length, 0);
  });

  it("keeps a collapsed dot segment on the EU API host", async () => {
    const { fetchImpl, calls } = mockFetch(() => new Response("ok"));
    const response = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/static/../e/"),
      { fetchImpl },
    );

    assert.equal(response.status, 200);
    assert.equal(calls[0]?.url, `https://${POSTHOG_EU_API_HOST}/e/`);
    assert.equal(calls[0]?.url.includes("eu-assets"), false);
  });

  it("returns 502 when upstream throws and does not log the project token", async () => {
    const apiKey = "phc_fake_review_only";
    await withCapturedLogs(async (logs) => {
      const response = await proxyPosthogIngest(
        new Request(
          `https://neutro.solutions/ingest/array/${apiKey}/config.js`,
        ),
        {
          cache: null,
          fetchImpl: (async () => {
            throw new Error(`network down ${apiKey}`);
          }) as typeof fetch,
        },
      );
      assert.equal(response.status, 502);
      assert.equal(await response.text(), "");
      assert.equal(logs.length, 1);
      assert.match(logs[0] ?? "", /^posthog_proxy_error /);
      assert.match(logs[0] ?? "", /"route":"array"/);
      assert.equal(
        logs.some((line) => line.includes(apiKey)),
        false,
      );
      assert.equal(
        logs.some((line) => line.includes("phc_")),
        false,
      );
    });
  });

  it("serves a cache hit without calling upstream and still strips set-cookie", async () => {
    const cache = memoryCache();
    await cache.put(
      new Request(`https://${POSTHOG_EU_ASSET_HOST}/static/array.js`),
      new Response("cached", {
        headers: {
          "content-type": "text/javascript",
          "set-cookie": "a=1",
        },
      }),
    );
    const { fetchImpl, calls } = mockFetch(() => new Response("upstream"));
    const response = await proxyPosthogIngest(
      new Request("https://neutro.solutions/ingest/static/array.js"),
      { fetchImpl, cache },
    );

    assert.equal(calls.length, 0);
    assert.equal(await response.text(), "cached");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("content-type"), "text/javascript");
  });
});

describe("isServerAnalyticsEnabled", () => {
  it("requires both the flag and a key", () => {
    assert.equal(
      isServerAnalyticsEnabled({
        ANALYTICS_ENABLED: "true",
        POSTHOG_KEY: "phc_test",
      }),
      true,
    );
    assert.equal(
      isServerAnalyticsEnabled({ ANALYTICS_ENABLED: "true" }),
      false,
    );
    assert.equal(
      isServerAnalyticsEnabled({
        ANALYTICS_ENABLED: "false",
        POSTHOG_KEY: "phc_test",
      }),
      false,
    );
  });
});
