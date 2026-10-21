import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FLYER_QR_SLUGS,
  QR_LANDING_ORIGIN,
  QR_REDIRECT_HEADERS,
  createQrRedirectResponse,
  normalizeQrPathname,
  resolveQrRedirect,
} from "./qr-redirects.ts";

describe("normalizeQrPathname", () => {
  it("strips a single trailing slash", () => {
    assert.equal(normalizeQrPathname("/f/1/"), "/f/1");
    assert.equal(normalizeQrPathname("/t/"), "/t");
  });

  it("leaves root and non-trailing paths unchanged", () => {
    assert.equal(normalizeQrPathname("/"), "/");
    assert.equal(normalizeQrPathname("/f/1"), "/f/1");
  });
});

describe("resolveQrRedirect — flyer ids", () => {
  for (const [id, slug] of Object.entries(FLYER_QR_SLUGS)) {
    it(`/f/${id} → utm_content=${slug}`, () => {
      const result = resolveQrRedirect(`/f/${id}`);
      assert.ok(result);
      assert.equal(result.status, 302);
      assert.deepEqual(result.headers, QR_REDIRECT_HEADERS);

      const url = new URL(result.location);
      assert.equal(url.origin, QR_LANDING_ORIGIN);
      assert.equal(url.pathname, "/");
      assert.equal(url.searchParams.get("utm_source"), "flyer");
      assert.equal(url.searchParams.get("utm_medium"), "qr");
      assert.equal(url.searchParams.get("utm_campaign"), "calle-oct26");
      assert.equal(url.searchParams.get("utm_content"), slug);

      assert.deepEqual(result.scanEvent, {
        slug,
        id,
        source: "flyer",
        campaign: "calle-oct26",
      });
    });

    it(`/f/${id}/ (trailing slash) matches /f/${id}`, () => {
      const withSlash = resolveQrRedirect(`/f/${id}/`);
      const without = resolveQrRedirect(`/f/${id}`);
      assert.deepEqual(withSlash, without);
    });
  }
});

describe("resolveQrRedirect — tarjeta", () => {
  it("/t → evergreen tarjeta UTMs", () => {
    const result = resolveQrRedirect("/t");
    assert.ok(result);
    assert.equal(result.status, 302);
    assert.deepEqual(result.headers, QR_REDIRECT_HEADERS);

    const url = new URL(result.location);
    assert.equal(url.origin, QR_LANDING_ORIGIN);
    assert.equal(url.searchParams.get("utm_source"), "tarjeta");
    assert.equal(url.searchParams.get("utm_medium"), "qr");
    assert.equal(url.searchParams.get("utm_campaign"), "evergreen-marca");
    assert.equal(url.searchParams.get("utm_content"), "tarjeta");

    assert.deepEqual(result.scanEvent, {
      slug: "tarjeta",
      id: "t",
      source: "tarjeta",
      campaign: "evergreen-marca",
    });
  });

  it("/t/ accepts trailing slash", () => {
    assert.deepEqual(resolveQrRedirect("/t/"), resolveQrRedirect("/t"));
  });
});

describe("resolveQrRedirect — unknown ids", () => {
  for (const path of ["/f/99", "/f/abc", "/f/0", "/f/9", "/f/-1", "/f/1a"]) {
    it(`${path} → landing with no UTMs`, () => {
      const result = resolveQrRedirect(path);
      assert.ok(result);
      assert.equal(result.status, 302);
      assert.equal(result.location, `${QR_LANDING_ORIGIN}/`);
      assert.equal(result.scanEvent, null);
      assert.deepEqual(result.headers, QR_REDIRECT_HEADERS);
      assert.ok(!result.location.includes("?"));
    });
  }

  it("/f/99/ trailing slash still untagged", () => {
    const result = resolveQrRedirect("/f/99/");
    assert.ok(result);
    assert.equal(result.location, `${QR_LANDING_ORIGIN}/`);
    assert.equal(result.scanEvent, null);
  });

  it("/f alone → untagged landing", () => {
    const result = resolveQrRedirect("/f");
    assert.ok(result);
    assert.equal(result.location, `${QR_LANDING_ORIGIN}/`);
    assert.equal(result.scanEvent, null);
  });
});

describe("resolveQrRedirect — defensive input", () => {
  it("returns null for non-QR paths", () => {
    assert.equal(resolveQrRedirect("/"), null);
    assert.equal(resolveQrRedirect("/about"), null);
    assert.equal(resolveQrRedirect("/token"), null);
  });

  it("returns null for empty / non-string", () => {
    assert.equal(resolveQrRedirect(""), null);
    assert.equal(resolveQrRedirect(undefined as unknown as string), null);
  });

  it("rejects control characters", () => {
    assert.equal(resolveQrRedirect("/f/1\n"), null);
    assert.equal(resolveQrRedirect("/t\u0000"), null);
  });

  it("malformed flyer paths redirect without UTMs", () => {
    const nested = resolveQrRedirect("/f/1/extra");
    assert.ok(nested);
    assert.equal(nested.location, `${QR_LANDING_ORIGIN}/`);
    assert.equal(nested.scanEvent, null);

    const dotted = resolveQrRedirect("/f/..");
    assert.ok(dotted);
    assert.equal(dotted.scanEvent, null);
  });
});

describe("createQrRedirectResponse — headers", () => {
  it("sets 302, Location, X-Robots-Tag, Cache-Control", () => {
    const redirect = resolveQrRedirect("/f/1");
    assert.ok(redirect);
    const response = createQrRedirectResponse(redirect);

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("Location"),
      `${QR_LANDING_ORIGIN}/?utm_source=flyer&utm_medium=qr&utm_campaign=calle-oct26&utm_content=2048`,
    );
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Cloudflare-CDN-Cache-Control"),
      "no-store",
    );
  });

  it("/f/8 sets Location with utm_content=excel", () => {
    const redirect = resolveQrRedirect("/f/8");
    assert.ok(redirect);
    const response = createQrRedirectResponse(redirect);

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("Location"),
      `${QR_LANDING_ORIGIN}/?utm_source=flyer&utm_medium=qr&utm_campaign=calle-oct26&utm_content=excel`,
    );
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(redirect.scanEvent, {
      slug: "excel",
      id: "8",
      source: "flyer",
      campaign: "calle-oct26",
    });
  });

  it("unknown id response has no query string and same safety headers", () => {
    const redirect = resolveQrRedirect("/f/abc");
    assert.ok(redirect);
    const response = createQrRedirectResponse(redirect);

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${QR_LANDING_ORIGIN}/`);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Cloudflare-CDN-Cache-Control"),
      "no-store",
    );
  });
});
