import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROSPECT_CODES,
  PROSPECT_LANDING_ORIGIN,
  PROSPECT_UTM,
} from "./prospect-codes.ts";
import {
  PROSPECT_REDIRECT_HEADERS,
  classifyProspectUserAgent,
  createProspectNotFoundResponse,
  createProspectRedirectResponse,
  prospectAccessCounts,
  resolveProspectRedirect,
} from "./prospect-redirects.ts";

describe("resolveProspectRedirect — valid codes", () => {
  for (const code of Object.keys(PROSPECT_CODES)) {
    it(`/p/${code} → home with outbound UTMs`, () => {
      const result = resolveProspectRedirect(`/p/${code}`);
      assert.ok(result);
      assert.equal(result.kind, "redirect");
      if (result.kind !== "redirect") {
        return;
      }
      assert.equal(result.status, 302);
      assert.deepEqual(result.headers, PROSPECT_REDIRECT_HEADERS);

      const url = new URL(result.location);
      assert.equal(url.origin, PROSPECT_LANDING_ORIGIN);
      assert.equal(url.pathname, "/");
      assert.equal(url.searchParams.get("utm_source"), PROSPECT_UTM.source);
      assert.equal(url.searchParams.get("utm_medium"), PROSPECT_UTM.medium);
      assert.equal(
        url.searchParams.get("utm_campaign"),
        PROSPECT_UTM.testCampaign,
      );
      assert.equal(url.searchParams.get("utm_content"), code);
      assert.deepEqual(result.accessEvent, {
        code,
        source: PROSPECT_UTM.source,
        medium: PROSPECT_UTM.medium,
        campaign: PROSPECT_UTM.testCampaign,
      });
    });

    it(`/p/${code}/ trailing slash matches`, () => {
      assert.deepEqual(
        resolveProspectRedirect(`/p/${code}/`),
        resolveProspectRedirect(`/p/${code}`),
      );
    });
  }

  it("test codes use utm_campaign=prueba-prospeccion", () => {
    const result = resolveProspectRedirect("/p/t001");
    assert.ok(result);
    assert.equal(result.kind, "redirect");
    if (result.kind !== "redirect") {
      return;
    }
    const url = new URL(result.location);
    assert.equal(url.searchParams.get("utm_campaign"), "prueba-prospeccion");
  });

  it("real campaign default stays configured for non-test codes", () => {
    assert.equal(PROSPECT_UTM.campaign, "prospeccion-2026-11-10");
    assert.equal(PROSPECT_UTM.testCampaign, "prueba-prospeccion");
    assert.equal(PROSPECT_UTM.source, "whatsapp");
    assert.equal(PROSPECT_UTM.medium, "outbound");
  });
});

describe("resolveProspectRedirect — unknown / invalid", () => {
  for (const path of [
    "/p",
    "/p/",
    "/p/zzzz",
    "/p/t00",
    "/p/t0011",
    "/p/T001",
    "/p/t00!",
    "/p/../t001",
    "/p/t001/extra",
  ]) {
    it(`${path} → 404 without Location`, () => {
      const result = resolveProspectRedirect(path);
      assert.ok(result);
      assert.equal(result.kind, "not_found");
      if (result.kind !== "not_found") {
        return;
      }
      assert.equal(result.status, 404);
      assert.equal(result.accessEvent, null);
      assert.deepEqual(result.headers, PROSPECT_REDIRECT_HEADERS);
      const response = createProspectNotFoundResponse(result);
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("Location"), null);
      assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    });
  }

  it("non-prospect paths return null", () => {
    assert.equal(resolveProspectRedirect("/"), null);
    assert.equal(resolveProspectRedirect("/f/1"), null);
    assert.equal(resolveProspectRedirect("/about"), null);
  });
});

describe("createProspectRedirectResponse", () => {
  it("sets 302, Location with utm, noindex, no-store", () => {
    const redirect = resolveProspectRedirect("/p/t002");
    assert.ok(redirect);
    assert.equal(redirect.kind, "redirect");
    if (redirect.kind !== "redirect") {
      return;
    }
    const response = createProspectRedirectResponse(redirect);
    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("Location"),
      `${PROSPECT_LANDING_ORIGIN}/?utm_source=whatsapp&utm_medium=outbound&utm_campaign=prueba-prospeccion&utm_content=t002`,
    );
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Cloudflare-CDN-Cache-Control"),
      "no-store",
    );
  });
});

describe("classifyProspectUserAgent / prospectAccessCounts", () => {
  it("flags preview bots", () => {
    assert.equal(classifyProspectUserAgent("WhatsApp/2.0"), "preview");
    assert.equal(
      classifyProspectUserAgent("facebookexternalhit/1.1"),
      "preview",
    );
    assert.equal(classifyProspectUserAgent("Twitterbot/1.0"), "preview");
    assert.equal(
      classifyProspectUserAgent("Slackbot-LinkExpanding"),
      "preview",
    );
    assert.equal(
      classifyProspectUserAgent("TelegramBot (like TwitterBot)"),
      "preview",
    );
    assert.equal(
      classifyProspectUserAgent(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
      "other",
    );
    assert.equal(classifyProspectUserAgent(null), "other");
  });

  it("HEAD and preview do not count as people", () => {
    assert.equal(prospectAccessCounts("GET", "other"), true);
    assert.equal(prospectAccessCounts("HEAD", "other"), false);
    assert.equal(prospectAccessCounts("GET", "preview"), false);
    assert.equal(prospectAccessCounts("HEAD", "preview"), false);
  });
});
