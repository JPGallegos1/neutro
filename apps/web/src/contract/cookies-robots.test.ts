import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistPage } from "./dist.ts";

const SITE = "https://neutro.solutions";
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

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
  it("permite el sitio, bloquea /ingest y declara el sitemap", () => {
    const lines = readDistRobots()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    assert.ok(
      lines.includes("User-agent: *"),
      "robots.txt debe declarar User-agent: *",
    );
    assert.ok(lines.includes("Allow: /"), "robots.txt debe declarar Allow: /");
    assert.ok(
      lines.includes("Disallow: /ingest"),
      "robots.txt debe declarar Disallow: /ingest",
    );
    assert.ok(
      lines.includes("Disallow: /ingest/"),
      "robots.txt debe declarar Disallow: /ingest/",
    );
    assert.ok(
      lines.includes("Sitemap: https://neutro.solutions/sitemap-index.xml"),
      "robots.txt debe declarar Sitemap: https://neutro.solutions/sitemap-index.xml",
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
