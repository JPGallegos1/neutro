import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistPage } from "./dist.ts";

const SITE = "https://neutro.solutions";
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));
const STAR_AGENT = "*";
const ALLOWED_STAR_DISALLOWS = new Set(["/ingest", "/ingest/"]);
const SITEMAP_LINE = "Sitemap: https://neutro.solutions/sitemap-index.xml";

type RobotsDirective = { kind: string; value: string; raw: string };

type RobotsGroup = {
  agents: string[];
  directives: RobotsDirective[];
};

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function readDistRobots(): string {
  const path = join(distDir, "robots.txt");
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(
        `falta ${path}. El contrato lee robots.txt de astro build.`,
      );
    }
    throw error;
  }
}

function parseRobotsGroups(body: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    assert.ok(
      colon > 0,
      `línea de robots.txt sin directiva: ${JSON.stringify(rawLine)}`,
    );
    const kind = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    const directive: RobotsDirective = { kind, value, raw: line };

    if (kind === "user-agent") {
      if (current === null || current.directives.length > 0) {
        current = { agents: [value], directives: [] };
        groups.push(current);
      } else {
        current.agents.push(value);
      }
      continue;
    }

    if (kind === "sitemap") {
      groups.push({ agents: [], directives: [directive] });
      current = null;
      continue;
    }

    assert.ok(
      current !== null,
      `directiva ${JSON.stringify(line)} sin User-agent previo`,
    );
    current.directives.push(directive);
  }

  return groups;
}

function assertStarRobotsPolicy(body: string): void {
  const groups = parseRobotsGroups(body);
  const starGroups = groups.filter((group) =>
    group.agents.includes(STAR_AGENT),
  );
  assert.equal(
    starGroups.length,
    1,
    `robots.txt debe tener exactamente un grupo User-agent: *; hay ${starGroups.length}`,
  );
  const star = starGroups[0];
  assert.ok(star, "falta el grupo User-agent: *");
  assert.deepEqual(
    star.agents,
    [STAR_AGENT],
    `el grupo * no puede mezclar otros user-agents: ${star.agents.join(", ")}`,
  );

  for (const group of groups) {
    if (group.agents.includes(STAR_AGENT)) continue;
    const foreignDisallows = group.directives.filter(
      (d) => d.kind === "disallow",
    );
    assert.deepEqual(
      foreignDisallows,
      [],
      `Disallow fuera de User-agent: *: ${foreignDisallows.map((d) => d.raw).join("; ")}`,
    );
  }

  const allows = star.directives
    .filter((d) => d.kind === "allow")
    .map((d) => d.value);
  assert.ok(allows.includes("/"), "User-agent: * debe declarar Allow: /");

  const disallows = star.directives
    .filter((d) => d.kind === "disallow")
    .map((d) => d.value);
  assert.deepEqual(
    [...disallows].sort(),
    [...ALLOWED_STAR_DISALLOWS].sort(),
    `User-agent: * solo admite Disallow /ingest y /ingest/; recibió: ${disallows.join(", ") || "(ninguno)"}`,
  );

  const sitemapLines = groups.flatMap((group) =>
    group.directives
      .filter((d) => d.kind === "sitemap")
      .map((d) => `Sitemap: ${d.value}`),
  );
  assert.ok(
    sitemapLines.includes(SITEMAP_LINE),
    `robots.txt debe declarar ${SITEMAP_LINE}`,
  );
}

function withExtraStarDisallow(body: string, path: string): string {
  const needle = "User-agent: *";
  const index = body.indexOf(needle);
  assert.ok(index !== -1, "no se encontró User-agent: * para mutar");
  const insertAt = index + needle.length;
  return `${body.slice(0, insertAt)}\nDisallow: ${path}${body.slice(insertAt)}`;
}

function withDisallowsMovedToGooglebot(body: string): string {
  const withoutIngest = body
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed !== "Disallow: /ingest" && trimmed !== "Disallow: /ingest/"
      );
    })
    .join("\n");
  return `${withoutIngest.replace(/\s*$/, "")}\n\nUser-agent: Googlebot\nDisallow: /ingest\nDisallow: /ingest/\n`;
}

function isIngestOrFlyerHref(href: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(href, SITE).pathname;
  } catch {
    return false;
  }
  return (
    pathname === "/ingest" ||
    pathname.startsWith("/ingest/") ||
    pathname === "/f" ||
    pathname.startsWith("/f/")
  );
}

describe("dist/robots.txt", () => {
  it("permite el sitio, bloquea solo /ingest bajo User-agent: * y declara el sitemap", () => {
    assertStarRobotsPolicy(readDistRobots());
  });

  it("rechaza Disallow extra o fuera de User-agent: *", () => {
    const body = readDistRobots();
    assert.throws(
      () => assertStarRobotsPolicy(withExtraStarDisallow(body, "/")),
      /solo admite Disallow/,
    );
    assert.throws(
      () => assertStarRobotsPolicy(withExtraStarDisallow(body, "/trabajo")),
      /solo admite Disallow/,
    );
    assert.throws(
      () => assertStarRobotsPolicy(withDisallowsMovedToGooglebot(body)),
      /Disallow fuera de User-agent/,
    );
  });
});

describe("dist/cookies.html", () => {
  it("muestra /ingest y /f/ como texto, sin enlaces rastreables", () => {
    const root = readDistPage("cookies.html");
    const offenders = root.querySelectorAll("a").flatMap((anchor) => {
      const href = anchor.getAttribute("href");
      if (href === undefined) return [];
      if (!isIngestOrFlyerHref(href)) return [];
      return [`<a href="${href}">`];
    });
    assert.deepEqual(
      offenders,
      [],
      `dist/cookies.html no puede enlazar /ingest ni /f/: ${offenders.join("; ")}`,
    );

    const codes = root.querySelectorAll("code").map((el) => el.text.trim());
    assert.ok(
      codes.includes("neutro.solutions/ingest"),
      `falta <code>neutro.solutions/ingest</code> en dist/cookies.html (codes: ${codes.join(", ")})`,
    );
    assert.ok(
      codes.includes("neutro.solutions/f/8"),
      `falta <code>neutro.solutions/f/8</code> en dist/cookies.html (codes: ${codes.join(", ")})`,
    );
  });
});
