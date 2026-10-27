import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { HTMLElement } from "node-html-parser";

import { readDistPage } from "./dist.ts";

const SITE_NAME = "Neutro Solutions";
const TITLE_404 = "Página no encontrada — Neutro Solutions";
const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));
const siteSourcePath = fileURLToPath(
  new URL("../lib/site.ts", import.meta.url),
);

type BrandSnapshot = {
  siteNameSource: string;
  title404: string;
  organizationName: string;
  websiteName: string;
  manifestName: string;
  manifestShortName: string;
  ogSiteName: string;
};

function jsonLdGraphs(document: HTMLElement): Record<string, unknown>[] {
  return document
    .querySelectorAll('script[type="application/ld+json"]')
    .flatMap((script) => {
      try {
        const data = JSON.parse(script.text) as {
          "@graph"?: Record<string, unknown>[];
        };
        return data["@graph"] ?? [];
      } catch {
        return [];
      }
    });
}

function namesForType(
  graph: Record<string, unknown>[],
  type: string,
): string[] {
  return graph.flatMap((node) => {
    if (node["@type"] !== type) return [];
    const name = node.name;
    return typeof name === "string" ? [name] : [];
  });
}

function readManifest(): { name: string; short_name: string } {
  const raw = readFileSync(join(distDir, "site.webmanifest"), "utf8");
  return JSON.parse(raw) as { name: string; short_name: string };
}

function siteNameFromSource(source: string): string {
  const match = source.match(/name:\s*"([^"]+)"/);
  return match?.[1] ?? "";
}

function ogSiteNameFrom(document: HTMLElement): string {
  const values = document.querySelectorAll("meta").flatMap((meta) => {
    if (
      (meta.getAttribute("property") ?? "").toLowerCase() !== "og:site_name"
    ) {
      return [];
    }
    return [meta.getAttribute("content")?.trim() ?? ""];
  });
  return values[0] ?? "";
}

function brandSnapshot(): BrandSnapshot {
  const home = readDistPage("index.html");
  const page404 = readDistPage("404.html");
  const graph = jsonLdGraphs(home);
  const manifest = readManifest();
  const title =
    page404.querySelectorAll("title").map((node) => node.text.trim())[0] ?? "";
  return {
    siteNameSource: siteNameFromSource(readFileSync(siteSourcePath, "utf8")),
    title404: title,
    organizationName: namesForType(graph, "Organization")[0] ?? "",
    websiteName: namesForType(graph, "WebSite")[0] ?? "",
    manifestName: manifest.name,
    manifestShortName: manifest.short_name,
    ogSiteName: ogSiteNameFrom(home),
  };
}

function brandProblems(snapshot: BrandSnapshot, where: string): string[] {
  const problems: string[] = [];
  const expected: BrandSnapshot = {
    siteNameSource: SITE_NAME,
    title404: TITLE_404,
    organizationName: SITE_NAME,
    websiteName: SITE_NAME,
    manifestName: SITE_NAME,
    manifestShortName: SITE_NAME,
    ogSiteName: SITE_NAME,
  };
  for (const key of Object.keys(expected) as (keyof BrandSnapshot)[]) {
    if (snapshot[key] !== expected[key]) {
      problems.push(
        `${where} ${key}=${JSON.stringify(snapshot[key])}; se exige ${JSON.stringify(expected[key])}`,
      );
    }
  }
  return problems;
}

describe("marca Neutro Solutions", () => {
  it("unifica site.name, og:site_name, 404, JSON-LD y manifest", () => {
    const problems = brandProblems(brandSnapshot(), "marca");
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("falla si site.name queda en Neutro a secas", () => {
    const snapshot = brandSnapshot();
    snapshot.siteNameSource = "Neutro";
    const problems = brandProblems(snapshot, "mutación site.name");
    assert.ok(
      problems.some((problem) => problem.includes("siteNameSource")),
      problems.join("\n"),
    );
  });

  it("falla si el title de la 404 usa Neutro a secas", () => {
    const snapshot = brandSnapshot();
    snapshot.title404 = "Página no encontrada — Neutro";
    const problems = brandProblems(snapshot, "mutación title 404");
    assert.ok(
      problems.some((problem) => problem.includes("title404")),
      problems.join("\n"),
    );
  });

  it("falla si Organization.name del JSON-LD no es Neutro Solutions", () => {
    const snapshot = brandSnapshot();
    snapshot.organizationName = "Neutro";
    const problems = brandProblems(snapshot, "mutación Organization.name");
    assert.ok(
      problems.some((problem) => problem.includes("organizationName")),
      problems.join("\n"),
    );
  });

  it("falla si short_name del manifest no es Neutro Solutions", () => {
    const snapshot = brandSnapshot();
    snapshot.manifestShortName = "Neutro";
    const problems = brandProblems(snapshot, "mutación manifest.short_name");
    assert.ok(
      problems.some((problem) => problem.includes("manifestShortName")),
      problems.join("\n"),
    );
  });

  it("falla si og:site_name es Neutro a secas", () => {
    const snapshot = brandSnapshot();
    snapshot.ogSiteName = "Neutro";
    const problems = brandProblems(snapshot, "mutación og:site_name");
    assert.ok(
      problems.some((problem) => problem.includes("ogSiteName")),
      problems.join("\n"),
    );
  });
});
