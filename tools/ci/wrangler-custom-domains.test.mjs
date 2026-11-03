import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

const WEB_WRANGLER = `${ROOT}/apps/web/wrangler.jsonc`;
const ADMIN_WRANGLER = `${ROOT}/apps/admin/wrangler.jsonc`;

const WEB_CUSTOM_DOMAINS = ["neutro.solutions", "www.neutro.solutions"];
const ADMIN_CUSTOM_DOMAINS = ["admin.neutro.solutions"];

function parseJsonc(raw) {
  const withoutBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/^\s*\/\/.*$/gm, "");
  const withoutTrailingCommas = withoutLineComments.replace(
    /,\s*([}\]])/g,
    "$1",
  );
  return JSON.parse(withoutTrailingCommas);
}

function assertCustomDomainRoutes(config, expectedPatterns, label) {
  assert.ok(Array.isArray(config.routes), `${label}: falta routes[]`);
  const custom = config.routes.filter(
    (route) =>
      route &&
      typeof route === "object" &&
      route.custom_domain === true &&
      typeof route.pattern === "string",
  );
  const patterns = custom.map((route) => route.pattern).sort();
  assert.deepEqual(
    patterns,
    [...expectedPatterns].sort(),
    `${label}: routes custom_domain`,
  );
  for (const route of custom) {
    assert.equal(route.custom_domain, true, `${label}: ${route.pattern}`);
  }
}

function assertOptionalWorkersFlags(config, label) {
  if (Object.hasOwn(config, "workers_dev")) {
    assert.equal(config.workers_dev, false, `${label}: workers_dev`);
  }
  if (Object.hasOwn(config, "preview_urls")) {
    assert.equal(config.preview_urls, false, `${label}: preview_urls`);
  }
}

describe("wrangler custom domains", () => {
  it("declara custom_domain en web (apex + www) y admin", () => {
    const web = parseJsonc(readFileSync(WEB_WRANGLER, "utf8"));
    const admin = parseJsonc(readFileSync(ADMIN_WRANGLER, "utf8"));

    assertCustomDomainRoutes(web, WEB_CUSTOM_DOMAINS, "web");
    assertCustomDomainRoutes(admin, ADMIN_CUSTOM_DOMAINS, "admin");
    assertOptionalWorkersFlags(web, "web");
    assertOptionalWorkersFlags(admin, "admin");
  });
});
