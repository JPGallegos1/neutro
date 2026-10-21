import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  POSTHOG_EU_CAPTURE,
  buildQrCapturePayload,
  captureAck,
  captureQrScanned,
  isServerAnalyticsEnabled,
} from "./posthog.ts";

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
  it("accepts only a 2xx body that looks like the capture ack", () => {
    assert.equal(captureAck(200, '{"status":"Ok"}'), "accepted");
    assert.equal(captureAck(200, ""), "rejected");
    assert.equal(captureAck(401, "nope"), "rejected");
    assert.equal(captureAck(302, '{"status":"Ok"}'), "rejected");
    assert.equal(captureAck(500, '{"status":"Ok"}'), "rejected");
  });
});

describe("captureQrScanned", () => {
  it("posts to the EU capture host, drains the body, and does not log the key", async () => {
    const apiKey = "phc_test_secret_value";
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    let reads = 0;
    const calls: Array<{ url: string; init: RequestInit }> = [];

    try {
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
    } finally {
      console.log = original;
    }

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

  it("logs a rejection when capture does not ack, without throwing", async () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      await captureQrScanned(
        "phc_test_secret_value",
        event,
        (async () =>
          new Response("upstream down", { status: 503 })) as typeof fetch,
      );
    } finally {
      console.log = original;
    }
    assert.match(logs[0] ?? "", /^posthog_capture_rejected /);
    assert.match(logs[0] ?? "", /"status":503/);
  });

  it("swallows fetch failures so the redirect is not blocked", async () => {
    const logs: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      await captureQrScanned("phc_test_secret_value", event, (async () => {
        throw new Error("network down");
      }) as typeof fetch);
    } finally {
      console.log = original;
    }
    assert.match(logs[0] ?? "", /^posthog_capture_error /);
    assert.match(logs[0] ?? "", /network down/);
    assert.equal(
      logs.some((line) => line.includes("phc_test_secret_value")),
      false,
    );
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
