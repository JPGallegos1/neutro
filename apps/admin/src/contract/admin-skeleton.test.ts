import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import {
  ADMIN_INITIAL_STATE,
  adminReducer,
  pathForSection,
  sectionFromPathname,
} from "@/admin-machine";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(adminRoot, "src");

function listFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listFiles(full));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|css|html|json)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function readSrc(): { path: string; text: string }[] {
  return listFiles(srcRoot).map((path) => ({
    path: relative(adminRoot, path),
    text: readFileSync(path, "utf8"),
  }));
}

describe("aislamiento de apps", () => {
  it("falla si apps/admin importa apps/web o apps/muestras", () => {
    const forbidden =
      /from\s+["'][^"']*apps\/(web|muestras)[^"']*["']|from\s+["']@neutro\/(web|muestras)["']|["']\.\.\/\.\.\/web\/|["']\.\.\/\.\.\/muestras\//;
    const hits = readSrc().flatMap((file) => {
      if (!forbidden.test(file.text)) return [];
      return [`${file.path} importa web o muestras`];
    });
    assert.deepEqual(hits, []);
  });

  it("no declara dependencia de @neutro/web ni @neutro/muestras", () => {
    const pkg = JSON.parse(
      readFileSync(join(adminRoot, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    assert.equal(names.includes("@neutro/web"), false);
    assert.equal(names.includes("@neutro/muestras"), false);
  });
});

describe("shell Admin (sidebar + rutas)", () => {
  it("expone Mapeo de leads y Comercios / Leads / Áreas", () => {
    const shell = readFileSync(join(srcRoot, "admin-shell.tsx"), "utf8");
    assert.match(shell, /Mapeo de leads/);
    assert.match(shell, /data-admin-module="mapeo-de-leads"/);
    assert.match(shell, /data-admin-nav=\{item\.section\}/);
    assert.match(shell, /section:\s*"comercios"/);
    assert.match(shell, /section:\s*"leads"/);
    assert.match(shell, /section:\s*"areas"/);
    assert.match(shell, /label:\s*"Comercios"/);
    assert.match(shell, /label:\s*"Leads"/);
    assert.match(shell, /label:\s*"Áreas"/);
    assert.match(shell, /path:\s*"\/comercios"/);
    assert.match(shell, /path:\s*"\/leads"/);
    assert.match(shell, /path:\s*"\/areas"/);
    assert.match(shell, /@tanstack\/react-router/);
    assert.match(shell, /\{item\.label\}/);
  });

  it("resuelve secciones del reducer de forma predecible", () => {
    assert.equal(sectionFromPathname("/comercios"), "comercios");
    assert.equal(sectionFromPathname("/leads"), "leads");
    assert.equal(sectionFromPathname("/areas"), "areas");
    assert.equal(pathForSection("leads"), "/leads");
    const next = adminReducer(ADMIN_INITIAL_STATE, {
      type: "navigate",
      section: "areas",
    });
    assert.equal(next.section, "areas");
    assert.equal(next.accessLabel, ADMIN_INITIAL_STATE.accessLabel);
  });
});

describe("borde interno", () => {
  it("declara noindex, badge interno y pie Access", () => {
    const html = readFileSync(join(adminRoot, "index.html"), "utf8");
    const shell = readFileSync(join(srcRoot, "admin-shell.tsx"), "utf8");
    const machine = readFileSync(join(srcRoot, "admin-machine.ts"), "utf8");
    assert.match(html, /name="robots"[^>]*content="noindex,\s*nofollow"/);
    assert.match(shell, /data-admin-badge="interno"/);
    assert.match(shell, /\bInterno\b/);
    assert.match(shell, /data-admin-access-footer/);
    assert.match(shell, /Acceso vía/);
    assert.match(machine, /Cloudflare Access/);
  });

  it("prohíbe useState y useEffect en el código de apps/admin", () => {
    const hits = readSrc().flatMap((file) => {
      if (file.path.endsWith(".test.ts") || file.path.endsWith(".test.tsx")) {
        return [];
      }
      const banned = /\buseState\b|\buseEffect\b/;
      if (!banned.test(file.text)) return [];
      return [`${file.path} usa hooks prohibidos`];
    });
    assert.deepEqual(hits, []);
  });
});
