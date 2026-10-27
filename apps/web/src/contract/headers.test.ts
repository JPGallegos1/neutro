import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const publicHeadersPath = fileURLToPath(
  new URL("../../public/_headers", import.meta.url),
);
const distHeadersPath = fileURLToPath(
  new URL("../../dist/_headers", import.meta.url),
);

const MAX_RULES = 100;
const MAX_LINE_CHARS = 2000;

const IMMUTABLE = "public, max-age=31536000, immutable";
const HOUR = "public, max-age=3600";

const EXPECTED_CACHE_CONTROL = new Map<string, string>([
  ["/_astro/*", IMMUTABLE],
  ["/images/*", HOUR],
  ["/video/*", HOUR],
  ["/favicon.ico", HOUR],
  ["/favicon.svg", HOUR],
  ["/favicon-16x16.png", HOUR],
  ["/favicon-32x32.png", HOUR],
  ["/apple-touch-icon.png", HOUR],
  ["/icon-192.png", HOUR],
  ["/icon-512.png", HOUR],
  ["/site.webmanifest", HOUR],
  ["/og/*", HOUR],
]);

type HeaderRule = {
  pattern: string;
  headers: Map<string, string[]>;
  line: number;
};

type ParsedHeaders = {
  rules: HeaderRule[];
  lines: string[];
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegExp(pattern: string): RegExp {
  const splatCount = (pattern.match(/\*/g) ?? []).length;
  assert.ok(
    splatCount <= 1,
    `el patrón ${JSON.stringify(pattern)} tiene más de un splat`,
  );
  const source = escapeRegExp(pattern).replace("\\*", ".*");
  return new RegExp(`^${source}$`);
}

function patternsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const aHasSplat = a.includes("*");
  const bHasSplat = b.includes("*");
  if (!aHasSplat && !bHasSplat) return false;
  if (aHasSplat && patternToRegExp(a).test(b.replaceAll("*", "x"))) return true;
  if (bHasSplat && patternToRegExp(b).test(a.replaceAll("*", "x"))) return true;
  if (aHasSplat && bHasSplat) {
    const aPrefix = a.slice(0, a.indexOf("*"));
    const bPrefix = b.slice(0, b.indexOf("*"));
    return aPrefix.startsWith(bPrefix) || bPrefix.startsWith(aPrefix);
  }
  return false;
}

function parseHeadersFile(source: string): ParsedHeaders {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const rules: HeaderRule[] = [];
  let current: HeaderRule | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    assert.ok(
      raw.length <= MAX_LINE_CHARS,
      `línea ${index + 1} supera ${MAX_LINE_CHARS} caracteres (${raw.length})`,
    );
    if (raw.trim() === "") {
      current = null;
      continue;
    }
    if (raw.startsWith("#")) {
      throw new Error(`línea ${index + 1}: comentarios # no permitidos`);
    }
    if (/^[ \t]/.test(raw)) {
      assert.ok(current, `línea ${index + 1}: cabecera sin patrón`);
      const trimmed = raw.trim();
      const separator = trimmed.indexOf(":");
      assert.ok(
        separator > 0,
        `línea ${index + 1}: cabecera inválida ${JSON.stringify(raw)}`,
      );
      const name = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      assert.ok(name.length > 0, `línea ${index + 1}: nombre de cabecera vacío`);
      const values = current.headers.get(name) ?? [];
      values.push(value);
      current.headers.set(name, values);
      continue;
    }
    assert.ok(
      raw.startsWith("/"),
      `línea ${index + 1}: el patrón debe empezar con / (${JSON.stringify(raw)})`,
    );
    current = {
      pattern: raw.trim(),
      headers: new Map(),
      line: index + 1,
    };
    rules.push(current);
  }

  assert.ok(
    rules.length <= MAX_RULES,
    `hay ${rules.length} reglas; el máximo es ${MAX_RULES}`,
  );
  return { rules, lines };
}

function cacheControlByPattern(rules: HeaderRule[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const rule of rules) {
    const values = rule.headers.get("Cache-Control");
    if (!values) continue;
    assert.equal(
      values.length,
      1,
      `patrón ${rule.pattern}: Cache-Control repetido en la misma regla`,
    );
    assert.equal(
      map.has(rule.pattern),
      false,
      `patrón duplicado ${rule.pattern}`,
    );
    map.set(rule.pattern, values[0] ?? "");
  }
  return map;
}

function assertNoOverlappingCacheControl(rules: HeaderRule[]): void {
  const withCache = rules.filter((rule) => rule.headers.has("Cache-Control"));
  for (let i = 0; i < withCache.length; i += 1) {
    for (let j = i + 1; j < withCache.length; j += 1) {
      const left = withCache[i];
      const right = withCache[j];
      assert.ok(left && right);
      assert.equal(
        patternsOverlap(left.pattern, right.pattern),
        false,
        `Cache-Control se solapa entre ${left.pattern} (L${left.line}) y ${right.pattern} (L${right.line})`,
      );
    }
  }
}

describe("_headers (SEO-07)", () => {
  it("fija Cache-Control por ruta sin solapes ni comentarios", () => {
    const source = readFileSync(publicHeadersPath, "utf8");
    const { rules } = parseHeadersFile(source);
    const actual = cacheControlByPattern(rules);
    assert.deepEqual(
      [...actual.entries()].sort(([a], [b]) => a.localeCompare(b)),
      [...EXPECTED_CACHE_CONTROL.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    );
    assertNoOverlappingCacheControl(rules);
    for (const rule of rules) {
      assert.equal(
        (rule.pattern.match(/\*/g) ?? []).length <= 1,
        true,
        `más de un splat en ${rule.pattern}`,
      );
      assert.equal(
        rule.headers.size,
        1,
        `patrón ${rule.pattern}: solo Cache-Control en SEO-07`,
      );
      assert.equal(
        rule.headers.has("Cache-Control"),
        true,
        `patrón ${rule.pattern}: falta Cache-Control`,
      );
    }
    assert.equal(rules.length, EXPECTED_CACHE_CONTROL.size);
    assert.equal(actual.get("/_astro/*"), "public, max-age=31536000, immutable");
    for (const pattern of [
      "/images/*",
      "/video/*",
      "/favicon.ico",
      "/favicon.svg",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/apple-touch-icon.png",
      "/icon-192.png",
      "/icon-512.png",
      "/site.webmanifest",
      "/og/*",
    ] as const) {
      const value = actual.get(pattern);
      assert.equal(value, "public, max-age=3600");
      assert.equal(value?.includes("stale-while-revalidate"), false);
      assert.notEqual(value, "public, max-age=86400");
      assert.notEqual(
        value,
        "public, max-age=86400, stale-while-revalidate=604800",
      );
    }
  });

  it("copia _headers a dist tras el build", () => {
    assert.equal(
      existsSync(distHeadersPath),
      true,
      "falta dist/_headers; correr astro build antes de test:contract",
    );
    const publicSource = readFileSync(publicHeadersPath, "utf8");
    const distSource = readFileSync(distHeadersPath, "utf8");
    assert.equal(distSource, publicSource);
    parseHeadersFile(distSource);
  });
});
