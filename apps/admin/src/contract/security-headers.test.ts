import assert from "node:assert/strict";
import { describe, it } from "vitest";
import worker, { type AdminWorkerEnv } from "../../worker/index";
import { CSP_REPORT_ONLY } from "../../worker/security-headers";

const EXPECTED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
] as const;

function env(overrides?: Partial<AdminWorkerEnv>): AdminWorkerEnv {
  return {
    DB: {
      prepare() {
        throw new Error("db_unused");
      },
    },
    ASSETS: {
      fetch: async () =>
        new Response("<html>admin</html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    },
    ...overrides,
  };
}

describe("Content-Security-Policy-Report-Only (admin)", () => {
  it("pone Report-Only en HTML con todas las directivas clave", async () => {
    const res = await worker.fetch(new Request("https://admin.test/"), env());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
    const csp = res.headers.get("Content-Security-Policy-Report-Only");
    assert.equal(csp, CSP_REPORT_ONLY);
    assert.equal(csp, EXPECTED_CSP_DIRECTIVES.join("; "));
    for (const directive of EXPECTED_CSP_DIRECTIVES) {
      assert.equal(
        csp?.includes(directive) ?? false,
        true,
        `CSP missing directive: ${directive}`,
      );
    }
    assert.equal(res.headers.get("Content-Security-Policy"), null);
  });

  it("no pone CSP en JSON de API", async () => {
    const res = await worker.fetch(
      new Request(
        "https://admin.test/api/comercios?lat=-32.9442&lng=-60.6505&radiusKm=3",
      ),
      env(),
    );
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assert.equal(res.headers.get("Content-Security-Policy"), null);
    assert.equal(res.headers.get("Content-Security-Policy-Report-Only"), null);
  });

  it("no pone CSP en assets no-HTML", async () => {
    const res = await worker.fetch(
      new Request("https://admin.test/assets/app.css"),
      env({
        ASSETS: {
          fetch: async () =>
            new Response("body{}", {
              status: 200,
              headers: { "content-type": "text/css" },
            }),
        },
      }),
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(res.headers.get("Content-Security-Policy"), null);
    assert.equal(res.headers.get("Content-Security-Policy-Report-Only"), null);
  });
});
