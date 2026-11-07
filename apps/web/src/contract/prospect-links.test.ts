import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistPage, readDistSitemaps } from "./dist.ts";

const SITE = "https://neutro.solutions";
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

function readDistRobots(): string {
  return readFileSync(join(distDir, "robots.txt"), "utf8");
}

describe("prospect /p/ SEO contract", () => {
  it("home canonical stays clean without query params", () => {
    const home = readDistPage("index.html");
    const hrefs = home.querySelectorAll("link").flatMap((link) => {
      const rel = (link.getAttribute("rel") ?? "").toLowerCase();
      if (!rel.split(/\s+/).includes("canonical")) {
        return [];
      }
      return [link.getAttribute("href") ?? ""];
    });
    assert.deepEqual(hrefs, [`${SITE}/`]);
    assert.equal(hrefs[0]?.includes("?"), false);
    assert.equal(hrefs[0]?.includes("utm_"), false);
  });

  it("excludes /p/ from the sitemap", () => {
    const sitemaps = readDistSitemaps();
    const offenders = sitemaps.locs.filter((entry) => {
      let pathname: string;
      try {
        pathname = new URL(entry.loc).pathname;
      } catch {
        return true;
      }
      const normalized = pathname.replace(/\/+$/, "") || "/";
      return normalized === "/p" || normalized.startsWith("/p/");
    });
    assert.deepEqual(
      offenders,
      [],
      `sitemap no puede listar /p/: ${offenders
        .map((entry) => entry.loc)
        .join(", ")}`,
    );
  });

  it("does not Disallow /p/ in robots.txt", () => {
    const body = readDistRobots();
    const disallowLines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().startsWith("disallow:"));
    assert.equal(
      disallowLines.some((line) => {
        const value = line.slice("disallow:".length).trim();
        return value === "/p" || value === "/p/" || value.startsWith("/p/");
      }),
      false,
      `robots.txt no debe bloquear /p/: ${disallowLines.join("; ")}`,
    );
  });
});
