import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { createComercio } from "@/comercio";
import {
  FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS,
  LEAD_CSV_MIN_COLUMNS,
  assertFitLeadsCsv,
  assertLeadsCsvBlobText,
  blobFromLeadsCsv,
  createLeadsCsvDownload,
  csvHasForbiddenGooglePlacesColumns,
  escapeCsv,
  exportLeadsCsv,
  leadCsvFitnessViolations,
  leadToCsvRow,
  leadsForCsvExport,
} from "@/leads/export-csv";
import {
  createFixtureGoogleLiveClient,
  googleLiveDoesNotTouchPlaces,
} from "@/leads/google-live";
import {
  createLeadFromComercio,
  filterLeadsByStatus,
  type Lead,
} from "@/leads/lead";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(adminRoot, "src");
const NOW = "2026-10-30T18:00:00.000Z";

function lead(id: string, patch?: Partial<Lead>): Lead {
  const base = createLeadFromComercio(
    createComercio({
      source: "osm",
      externalId: id,
      name: `Comercio ${id}`,
      lat: -32.9442,
      lng: -60.6505,
      website: id === "web" ? "https://example.com" : null,
      socialUrls: id === "red" ? ["https://ig.com/x"] : [],
      address: `Calle ${id}`,
    })!,
    { now: NOW, notes: "Seguimiento", assignee: "ops@neutro.solutions" },
  );
  return patch ? { ...base, ...patch } : base;
}

function walk(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      out.push(...walk(path));
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(name)) continue;
    out.push({ path: relative(adminRoot, path), text: readFileSync(path, "utf8") });
  }
  return out;
}

describe("Export CSV Leads + fitness Google (#93)", () => {
  it("columnas mínimas: id, fuente, flags, estado, notas, responsable", () => {
    assert.deepEqual([...LEAD_CSV_MIN_COLUMNS], [
      "id",
      "source",
      "external_id",
      "status",
      "notes",
      "assignee",
      "sin_website",
      "tiene_redes",
    ]);
    const row = leadToCsvRow(lead("a"));
    for (const col of LEAD_CSV_MIN_COLUMNS) {
      assert.ok(col in row, col);
    }
    assert.deepEqual(
      [row.id, row.source, row.external_id, row.status, row.notes, row.assignee],
      [
        "lead_osm_a",
        "osm",
        "a",
        "nuevo",
        "Seguimiento",
        "ops@neutro.solutions",
      ],
    );
    assert.deepEqual([row.sin_website, row.tiene_redes], ["1", "0"]);
    assert.equal(leadToCsvRow(lead("web")).sin_website, "0");
    assert.equal(leadToCsvRow(lead("red")).tiene_redes, "1");
  });

  it("CSV de filtrados incluye mínimas y excluye Google Places", () => {
    const items = [
      lead("a", { status: "nuevo" }),
      lead("b", { status: "contactado", notes: "Llamar" }),
      lead("c", { status: "interesado" }),
    ];
    const filtered = filterLeadsByStatus(items, "contactado");
    const csv = exportLeadsCsv(filtered);
    const lines = csv.trimEnd().split("\n");
    assert.equal(lines[0], LEAD_CSV_MIN_COLUMNS.join(","));
    assert.equal(lines.length, 2);
    assert.match(lines[1]!, /contactado/);
    assert.match(lines[1]!, /Llamar/);
    assert.doesNotMatch(csv, /interesado|lead_osm_a|lead_osm_c/);
    assert.equal(csvHasForbiddenGooglePlacesColumns(csv), false);
    assert.deepEqual(leadCsvFitnessViolations(csv), []);
    for (const bad of FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS) {
      assert.equal(lines[0]!.split(",").includes(bad), false, bad);
    }
  });

  it("fitness: mutation-red si CSV agrega columnas Google Places", () => {
    const poisoned = `${LEAD_CSV_MIN_COLUMNS.join(",")},displayName,rating\nid,osm,x,nuevo,,,1,0,Google · X,4.2`;
    assert.equal(csvHasForbiddenGooglePlacesColumns(poisoned), true);
    assert.ok(leadCsvFitnessViolations(poisoned).length > 0);
    assert.ok(
      FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS.includes("displayName") &&
        FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS.includes("formattedAddress") &&
        FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS.includes("rating") &&
        FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS.includes("openingHours"),
    );
    const src = readFileSync(join(srcRoot, "leads/export-csv.ts"), "utf8");
    assert.match(src, /export const LEAD_CSV_MIN_COLUMNS/);
    assert.match(src, /export const FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS/);
    assert.equal(
      LEAD_CSV_MIN_COLUMNS.some((c) =>
        (FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS as readonly string[]).includes(c),
      ),
      false,
    );
    assert.match(src, /sin_website/);
    assert.match(src, /tiene_redes/);
    assert.doesNotMatch(
      src,
      /LEAD_CSV_MIN_COLUMNS = \[[^\]]*displayName/,
    );
  });

  it("fitness: Google live no toca places; admin sin web/muestras", () => {
    assert.equal(googleLiveDoesNotTouchPlaces(), true);
    const live = createFixtureGoogleLiveClient();
    void live.fetchForLead({ name: "X", lat: -32.9, lng: -60.6 });
    assert.equal(googleLiveDoesNotTouchPlaces(), true);
    const forbidden = /from\s+["'](?:\.\.\/)*web(?:\/|$)|from\s+["'](?:\.\.\/)*muestras(?:\/|$)|@neutro\/(?:web|muestras)/;
    const hits = walk(srcRoot).flatMap((file) => {
      if (file.path.includes("contract/")) return [];
      return file.text.split("\n").flatMap((line, i) =>
        forbidden.test(line) ? [`${file.path}:${i + 1}`] : [],
      );
    });
    assert.deepEqual(hits, []);
  });

  it("escapeCsv: comma, comillas y newline; export lo usa", () => {
    assert.equal(escapeCsv("plain"), "plain");
    assert.equal(escapeCsv("a,b"), '"a,b"');
    assert.equal(escapeCsv('dice "hola"'), '"dice ""hola"""');
    assert.equal(escapeCsv("linea1\nlinea2"), '"linea1\nlinea2"');
    assert.equal(escapeCsv("x\ry"), '"x\ry"');
    const comma = exportLeadsCsv([lead("c", { notes: "a,b" })]);
    assert.match(comma, /"a,b"/);
    assert.equal(comma.split("\n")[1]!.includes(",a,b,"), false);
    const quoted = exportLeadsCsv([lead("q", { notes: 'dice "hola"' })]);
    assert.match(quoted, /"dice ""hola"""/);
    const nl = exportLeadsCsv([lead("n", { notes: "linea1\nlinea2" })]);
    assert.match(nl, /"linea1\nlinea2"/);
    const src = readFileSync(join(srcRoot, "leads/export-csv.ts"), "utf8");
    assert.match(src, /escapeCsv\(row\[col\]\)/);
    assert.equal(src.split("escapeCsv(row[col])").length - 1, 1);
  });

  it("MEDIO3: leadsForCsvExport + createLeadsCsvDownload filtran", async () => {
    const items = [
      lead("a", { status: "nuevo" }),
      lead("b", { status: "contactado", notes: "Solo este" }),
      lead("c", { status: "interesado" }),
    ];
    const onlyContactado = leadsForCsvExport(items, "contactado");
    assert.equal(onlyContactado.length, 1);
    assert.equal(onlyContactado[0]?.status, "contactado");
    assert.equal(leadsForCsvExport(items, "todos").length, 3);
    assert.notDeepEqual(
      leadsForCsvExport(items, "contactado").map((l) => l.id),
      leadsForCsvExport(items, "todos").map((l) => l.id),
    );
    const csv = exportLeadsCsv(leadsForCsvExport(items, "contactado"));
    assert.match(csv, /contactado/);
    assert.doesNotMatch(csv, /interesado|lead_osm_a|lead_osm_c/);
    const download = createLeadsCsvDownload(items, "contactado");
    const blobText = await download.blob.text();
    assert.equal(blobText.split(/\r?\n/, 1)[0], LEAD_CSV_MIN_COLUMNS.join(","));
    assert.deepEqual(leadCsvFitnessViolations(blobText), []);
    assert.equal(assertLeadsCsvBlobText(blobText), blobText);
    const dataLines = blobText.trimEnd().split("\n").slice(1);
    assert.equal(dataLines.length, 1);
    assert.match(dataLines[0]!, /contactado/);
    assert.match(dataLines[0]!, /Solo este/);
    assert.doesNotMatch(blobText, /interesado|lead_osm_a|lead_osm_c|\bnuevo\b/);
    for (const bad of FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS) {
      assert.equal(blobText.includes(bad), false, bad);
    }
    const src = readFileSync(join(srcRoot, "leads/export-csv.ts"), "utf8");
    assert.match(src, /function leadsForCsvExport[\s\S]*return filterLeadsByStatus\(leads,\s*filter\)/);
    assert.doesNotMatch(src, /function leadsForCsvExport[\s\S]*return leads\s*;/);
    assert.match(
      src,
      /blobFromLeadsCsv\(exportLeadsCsv\(leadsForCsvExport\(leads,\s*filter\)\)\)/,
    );
    assert.equal(
      src.split("exportLeadsCsv(leadsForCsvExport(leads, filter))").length - 1,
      1,
    );
    assert.doesNotMatch(src, /createLeadsCsvDownload[\s\S]*exportLeadsCsv\(leads\)/);
    assert.doesNotMatch(
      src,
      /createLeadsCsvDownload[\s\S]*leadsForCsvExport\(leads,\s*"todos"\)/,
    );
    assert.doesNotMatch(
      src,
      /createLeadsCsvDownload[\s\S]*leadsForCsvExport\(leads,\s*'todos'\)/,
    );
    const page = readFileSync(join(srcRoot, "leads/leads-page.tsx"), "utf8");
    assert.match(
      page,
      /createLeadsCsvDownload\(\s*leads,\s*state\.leadsStatusFilter/,
    );
    assert.equal(page.split("createLeadsCsvDownload(").length - 1, 1);
  });

  it("MEDIO4 formal: blob header + post-fitness displayName,rating poison", async () => {
    const ok = exportLeadsCsv([lead("a")]);
    assert.deepEqual(leadCsvFitnessViolations(ok), []);
    assert.equal(assertFitLeadsCsv(ok), ok);
    const blob = blobFromLeadsCsv(ok);
    assert.equal(blob.type, "text/csv;charset=utf-8");
    const blobText = await blob.text();
    assert.equal(blobText, ok);
    assert.equal(blobText.split(/\r?\n/, 1)[0], LEAD_CSV_MIN_COLUMNS.join(","));
    assert.deepEqual(leadCsvFitnessViolations(blobText), []);
    assert.equal(assertLeadsCsvBlobText(blobText), blobText);
    for (const bad of FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS) {
      assert.equal(blobText.includes(bad), false, bad);
    }
    const headerPoison = ok.replace("\n", ",displayName,rating\n");
    assert.notEqual(headerPoison.split(/\r?\n/, 1)[0], LEAD_CSV_MIN_COLUMNS.join(","));
    assert.ok(leadCsvFitnessViolations(headerPoison).length > 0);
    assert.throws(
      () => assertLeadsCsvBlobText(headerPoison),
      /csv_header_mismatch|csv_fitness_failed|google_col/,
    );
    assert.throws(
      () => blobFromLeadsCsv(headerPoison),
      /csv_header_mismatch|csv_fitness_failed|google_col/,
    );
    assert.throws(
      () => assertFitLeadsCsv(headerPoison),
      /csv_header_mismatch|csv_fitness_failed|google_col/,
    );
    const poisoned = `${LEAD_CSV_MIN_COLUMNS.join(",")},displayName,rating\nx,osm,x,nuevo,,,1,0,Google,4.2`;
    assert.throws(
      () => blobFromLeadsCsv(poisoned),
      /csv_header_mismatch|csv_fitness_failed|google_col/,
    );
    const download = createLeadsCsvDownload(
      [lead("a"), lead("b", { status: "contactado" })],
      "contactado",
    );
    assert.equal(download.filename, "leads.csv");
    const filteredText = await download.blob.text();
    assert.equal(filteredText.split(/\r?\n/, 1)[0], LEAD_CSV_MIN_COLUMNS.join(","));
    assert.deepEqual(leadCsvFitnessViolations(filteredText), []);
    assert.equal(assertLeadsCsvBlobText(filteredText), filteredText);
    assert.equal(filteredText.trimEnd().split("\n").length, 2);
    assert.doesNotMatch(filteredText, /displayName|rating|lead_osm_a/);
    const src = readFileSync(join(srcRoot, "leads/export-csv.ts"), "utf8");
    assert.match(src, /return new Blob\(\[assertFitLeadsCsv\(csv\)\],/);
    assert.match(src, /function assertFitLeadsCsv/);
    assert.match(
      src,
      /function assertFitLeadsCsv[\s\S]*header !== LEAD_CSV_MIN_COLUMNS\.join\(\",\"\)/,
    );
    assert.match(src, /assertLeadsCsvBlobText[\s\S]*return assertFitLeadsCsv\(text\)/);
    assert.equal(src.split("new Blob(").length - 1, 1);
    assert.doesNotMatch(src, /new Blob\(\[[^\]]*(displayName|rating|formattedAddress)/);
    assert.doesNotMatch(src, /new Blob\(\[csv\s*\+|new Blob\(\[csv\s*,/);
    assert.doesNotMatch(src, /assertFitLeadsCsv\(csv\)\.replace|assertFitLeadsCsv\(csv\)\s*\+/);
    assert.doesNotMatch(
      src,
      /function blobFromLeadsCsv[\s\S]*assertFitLeadsCsv\(csv\)[\s\S]*\bcsv\s*=/,
    );
    assert.doesNotMatch(
      src,
      /function blobFromLeadsCsv[\s\S]*new Blob\(\[csv\.replace/,
    );
    assert.doesNotMatch(src, /assertFitLeadsCsv\(csv\);\s*csv\s*=/);
    assert.doesNotMatch(src, /csv\.replace\(\s*["']\\n["']\s*,\s*["'],displayName,rating/);
    assert.doesNotMatch(
      src,
      /function assertFitLeadsCsv\([^)]*\)[^{]*\{\s*if \(leadCsvFitnessViolations/,
    );
    const page = readFileSync(join(srcRoot, "leads/leads-page.tsx"), "utf8");
    assert.doesNotMatch(page, /new Blob\(/);
    const exportFn = /function onExportCsv\([\s\S]*?\n  \}/.exec(page)?.[0] ?? "";
    assert.match(exportFn, /createLeadsCsvDownload/);
    assert.doesNotMatch(exportFn, /displayName|rating|formattedAddress/);
  });

  it("UI Leads: onClick + download click cableados", () => {
    const page = readFileSync(join(srcRoot, "leads/leads-page.tsx"), "utf8");
    assert.match(page, /data-admin-leads-export/);
    assert.match(page, /Exportar CSV/);
    assert.match(page, /onClick=\{onExportCsv\}/);
    assert.match(page, /function onExportCsv\(/);
    assert.match(page, /anchor\.click\(\)/);
    assert.match(page, /anchor\.download\s*=\s*filename/);
    assert.match(page, /URL\.createObjectURL\(blob\)/);
    assert.match(
      page,
      /createLeadsCsvDownload\(\s*leads,\s*state\.leadsStatusFilter/,
    );
    assert.doesNotMatch(page, /\buseState\b|\buseEffect\b/);
    assert.equal(page.split("onClick={onExportCsv}").length - 1, 1);
    assert.equal(page.split("anchor.click()").length - 1, 1);
  });
});
