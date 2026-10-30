import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import {
  ADMIN_INITIAL_STATE,
  adminReducer,
  type AdminState,
} from "@/admin-machine";
import {
  comercioKey,
  createComercio,
  searchComerciosFromFixtures,
} from "@/comercio";
import type { D1DatabaseLike } from "@/d1-search-area-repository";
import {
  createD1LeadRepository,
  type D1PreparedStatement,
} from "@/leads/d1-lead-repository";
import {
  INITIAL_LEAD_STATUS,
  LEAD_STATUSES,
  createLeadFromComercio,
  createMemoryLeadRepository,
  leadKey,
  mergeLeadsByIdentity,
  saveSelectionAsLeads,
  type Lead,
} from "@/leads/lead";
import worker, { type AdminWorkerEnv } from "../../worker/index";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(adminRoot, "src");
const NOW = "2026-10-30T12:00:00.000Z";

function comercio(id: string) {
  return createComercio({
    source: "osm",
    externalId: id,
    name: id,
    lat: -32.94,
    lng: -60.65,
    website: null,
    socialUrls: [],
    rubro: "cafe",
  })!;
}

function fakeLeadDb() {
  const places = new Map<string, Record<string, unknown>>();
  const leads = new Map<string, Record<string, unknown>>();
  let bound: unknown[] = [];
  let lastSql = "";
  const placeKey = (s: unknown, e: unknown) => `${String(s)}:${String(e)}`;
  const joinRow = (placeId: string) => {
    const lead = [...leads.values()].find((l) => l.place_id === placeId);
    const place = [...places.values()].find((p) => p.id === placeId);
    if (!lead || !place) return null;
    return { ...place, ...lead, place_id: lead.place_id };
  };
  const stmt: D1PreparedStatement = {
    bind(...values: unknown[]) {
      bound = values;
      return stmt;
    },
    async all<T = Record<string, unknown>>() {
      const rows: Record<string, unknown>[] = [];
      for (const lead of leads.values()) {
        const row = joinRow(String(lead.place_id));
        if (row) rows.push(row);
      }
      return { results: rows as T[] };
    },
    async first<T = Record<string, unknown>>() {
      if (lastSql.includes("FROM places WHERE source")) {
        return (places.get(placeKey(bound[0], bound[1])) as T) ?? null;
      }
      if (lastSql.includes("WHERE places.id")) {
        return joinRow(String(bound[0])) as T | null;
      }
      return null;
    },
    async run() {
      if (lastSql.includes("INSERT INTO places")) {
        const key = placeKey(bound[1], bound[2]);
        const existing = places.get(key);
        places.set(key, {
          id: existing?.id ?? bound[0],
          source: bound[1],
          external_id: bound[2],
          name: bound[3],
          lat: bound[4],
          lng: bound[5],
          website: bound[6],
          address: bound[7],
          social_urls_json: bound[8],
          rubro: bound[9],
          attribution: bound[10],
          created_at: existing?.created_at ?? bound[11],
          updated_at: bound[12],
        });
      } else if (lastSql.includes("INSERT INTO leads")) {
        const placeId = String(bound[1]);
        if (![...leads.values()].some((l) => l.place_id === placeId)) {
          leads.set(String(bound[0]), {
            id: bound[0],
            place_id: placeId,
            status: bound[2],
            notes: bound[3],
            assignee: bound[4],
            created_at: bound[5],
            updated_at: bound[6],
          });
        }
      }
      return {};
    },
  };
  const db: D1DatabaseLike = {
    prepare(query: string) {
      lastSql = query;
      return stmt;
    },
  };
  return { db, places, leads };
}

function assetEnv(db: D1DatabaseLike): AdminWorkerEnv {
  return { DB: db, ASSETS: { fetch: async () => new Response("asset") } };
}

describe("Guardar como Lead — dominio", () => {
  it("estado inicial absoluto es nuevo y el catálogo lo incluye primero", () => {
    assert.equal(INITIAL_LEAD_STATUS, "nuevo");
    assert.equal(LEAD_STATUSES[0], "nuevo");
    assert.deepEqual(
      [...LEAD_STATUSES],
      ["nuevo", "contactado", "interesado", "descartado"],
    );
    const lead = createLeadFromComercio(comercio("a"), { now: NOW });
    assert.equal(lead.status, "nuevo");
    assert.notEqual(lead.status, "contactado");
    assert.equal(lead.notes, "");
    assert.equal(lead.assignee, null);
    assert.equal(leadKey(lead), "osm:a");
  });

  it("no duplica por source + external_id al guardar de nuevo", () => {
    const a = comercio("a");
    const b = comercio("b");
    const first = saveSelectionAsLeads([a, b], [], NOW);
    assert.equal(first.created.length, 2);
    assert.equal(first.reused.length, 0);
    assert.equal(first.all.length, 2);
    assert.ok(first.created.every((lead) => lead.status === "nuevo"));
    const second = saveSelectionAsLeads([a, b, a], first.all, NOW);
    assert.equal(second.created.length, 0);
    assert.equal(second.reused.length, 2);
    assert.equal(second.all.length, 2);
    assert.equal(second.reused[0]?.id, first.created[0]?.id);
    assert.equal(second.reused[0]?.status, "nuevo");
    assert.equal(mergeLeadsByIdentity(first.all, second.reused).length, 2);
  });

  it("memory repo: segundo save no agrega filas y reutiliza identidad", async () => {
    const repo = createMemoryLeadRepository({ now: NOW });
    const list = searchComerciosFromFixtures();
    const first = await repo.saveFromComercios([list[0]!, list[1]!]);
    assert.equal(first.length, 2);
    assert.ok(first.every((lead) => lead.status === "nuevo"));
    const again = await repo.saveFromComercios([list[0]!, list[1]!, list[0]!]);
    assert.equal(again.length, 2);
    assert.equal((await repo.list()).length, 2);
    assert.equal(again[0]?.id, first[0]?.id);
    assert.equal(again[0]?.status, "nuevo");
  });
});

describe("Guardar como Lead — D1 + SQL", () => {
  it("migración declara places UNIQUE(source,external_id) y leads.place_id UNIQUE", () => {
    const sql = readFileSync(
      join(adminRoot, "migrations/0002_places_leads.sql"),
      "utf8",
    );
    assert.match(sql, /CREATE TABLE IF NOT EXISTS places/);
    assert.match(sql, /UNIQUE\s*\(\s*source\s*,\s*external_id\s*\)/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS leads/);
    assert.match(sql, /place_id TEXT NOT NULL UNIQUE/);
    assert.doesNotMatch(sql, /place_id TEXT NOT NULL,/);
    assert.match(
      sql,
      /status TEXT NOT NULL CHECK \(status IN \('nuevo', 'contactado', 'interesado', 'descartado'\)\)/,
    );
    assert.doesNotMatch(sql, /google/i);
  });

  it("D1 fake: upsert place + lead sin duplicar source+external_id", async () => {
    const { db, places, leads } = fakeLeadDb();
    const repo = createD1LeadRepository(db);
    const a = comercio("dup");
    const first = await repo.saveFromComercios([a]);
    assert.equal(first.length, 1);
    assert.equal(first[0]?.status, "nuevo");
    assert.equal(places.size, 1);
    assert.equal(leads.size, 1);
    const second = await repo.saveFromComercios([a, a]);
    assert.equal(second.length, 1);
    assert.equal(second[0]?.id, first[0]?.id);
    assert.equal(places.size, 1);
    assert.equal(leads.size, 1);
    assert.equal((await repo.list()).length, 1);
  });
});

describe("Guardar como Lead — machine + UI", () => {
  it("saveLeadsSucceeded agrega leadKeys, estado nuevo y limpia selección", () => {
    const list = searchComerciosFromFixtures();
    const a = comercioKey(list[0]!);
    const b = comercioKey(list[1]!);
    let state: AdminState = adminReducer(ADMIN_INITIAL_STATE, {
      type: "comerciosHydrated",
      comercios: list,
      revision: 1,
    });
    state = adminReducer(state, { type: "toggleComercio", key: a });
    state = adminReducer(state, { type: "toggleComercio", key: b });
    assert.equal(state.selectedComercioKeys.size, 2);
    const leads: Lead[] = [
      createLeadFromComercio(list[0]!, { now: NOW }),
      createLeadFromComercio(list[1]!, { now: NOW }),
    ];
    state = adminReducer(state, { type: "saveLeadsRequested" });
    assert.equal(state.leadsStatus, "saving");
    state = adminReducer(state, {
      type: "saveLeadsSucceeded",
      leads,
      revision: 2,
    });
    assert.equal(state.leadsStatus, "ready");
    assert.equal(state.leads.length, 2);
    assert.equal(state.leadKeys.has(a), true);
    assert.equal(state.leadKeys.has(b), true);
    assert.equal(state.selectedComercioKeys.size, 0);
    assert.ok(state.leads.every((lead) => lead.status === "nuevo"));
    const again = adminReducer(state, {
      type: "saveLeadsSucceeded",
      leads,
      revision: 3,
    });
    assert.equal(again.leads.length, 2);
    assert.equal(again.leadKeys.size, 2);
  });

  it("leadsHydrated carga leadKeys sin pisar revision igual", () => {
    const lead = createLeadFromComercio(comercio("x"), { now: NOW });
    let state = adminReducer(ADMIN_INITIAL_STATE, {
      type: "leadsHydrated",
      leads: [lead],
      revision: 5,
    });
    assert.equal(state.leadsStatus, "ready");
    assert.equal(state.leadKeys.has("osm:x"), true);
    const same = adminReducer(state, {
      type: "leadsHydrated",
      leads: [],
      revision: 5,
    });
    assert.equal(same, state);
    assert.equal(same.leads.length, 1);
  });

  it("anti-clobber: stale/equal no pisa; revision mayor sí actualiza", () => {
    const list = searchComerciosFromFixtures();
    const saved = [
      createLeadFromComercio(list[0]!, { now: NOW }),
      createLeadFromComercio(list[1]!, { now: NOW }),
    ];
    const refreshed = [createLeadFromComercio(list[0]!, { now: NOW })];
    let state = adminReducer(ADMIN_INITIAL_STATE, {
      type: "leadsHydrated",
      leads: [],
      revision: 100,
    });
    state = adminReducer(state, { type: "saveLeadsRequested" });
    const duringSave = adminReducer(state, {
      type: "leadsHydrated",
      leads: [],
      revision: 200,
    });
    assert.equal(duringSave, state);
    assert.equal(duringSave.leadsStatus, "saving");
    state = adminReducer(state, {
      type: "saveLeadsSucceeded",
      leads: saved,
      revision: 101,
    });
    assert.equal(state.leads.length, 2);
    assert.equal(state.leadKeys.size, 2);
    assert.equal(state.leadsRevision, 101);
    const stale = adminReducer(state, {
      type: "leadsHydrated",
      leads: [],
      revision: 100,
    });
    assert.equal(stale, state);
    assert.equal(stale.leads.length, 2);
    assert.equal(stale.leadKeys.size, 2);
    assert.equal(stale.leadsRevision, 101);
    assert.equal(stale.leadKeys.has(leadKey(saved[0]!)), true);
    const equal = adminReducer(state, {
      type: "leadsHydrated",
      leads: [],
      revision: 101,
    });
    assert.equal(equal, state);
    assert.equal(equal.leads.length, 2);
    const fresh = adminReducer(state, {
      type: "leadsHydrated",
      leads: refreshed,
      revision: 102,
    });
    assert.notEqual(fresh, state);
    assert.equal(fresh.leadsRevision, 102);
    assert.equal(fresh.leads.length, 1);
    assert.equal(fresh.leadKeys.size, 1);
    assert.equal(fresh.leadKeys.has(leadKey(refreshed[0]!)), true);
    assert.equal(fresh.leadKeys.has(leadKey(saved[1]!)), false);
    const machine = readFileSync(join(srcRoot, "admin-machine.ts"), "utf8");
    assert.match(
      machine,
      /case "leadsHydrated":[\s\S]*?event\.revision <= state\.leadsRevision/,
    );
    assert.doesNotMatch(
      machine,
      /case "leadsHydrated":[\s\S]*?state\.leadsRevision !== event\.revision/,
    );
  });

  it("UI: botón Guardar como Lead, disabled sin selección, loader leads", () => {
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    const shell = readFileSync(join(srcRoot, "admin-shell.tsx"), "utf8");
    assert.match(page, /data-admin-guardar-leads/);
    assert.match(page, /Guardar como Lead/);
    assert.match(
      page,
      /disabled=\{\s*visibleSelectedCount === 0 \|\| state\.leadsStatus === "saving"\s*\}/,
    );
    assert.doesNotMatch(page, /disabled=\{false\}/);
    assert.doesNotMatch(page, /disabled=\{true\}/);
    assert.match(page, /saveLeadsRequested/);
    assert.match(page, /getLeadsClient\(\)\.save/);
    assert.match(page, /saveLeadsSucceeded/);
    assert.match(shell, /setLeadsClient/);
    assert.match(shell, /getLeadsClient/);
    assert.match(shell, /loadedLeads=/);
  });

  it("la página no despacha leadsHydrated en el cuerpo de render", () => {
    const page = readFileSync(join(srcRoot, "comercios-page.tsx"), "utf8");
    assert.doesNotMatch(page, /leadsRevision\s*!==\s*loadedLeadsRevision/);
    assert.doesNotMatch(page, /type:\s*"leadsHydrated"/);
    assert.doesNotMatch(page, /dispatch\(\{\s*type:\s*"leadsHydrated"/);
    assert.match(
      page,
      /const activeLeadKeys =\s*state\.leadsStatus === "idle"\s*\?\s*new Set\(loadedLeads\.map\(leadKey\)\)\s*:\s*state\.leadKeys/,
    );
    assert.doesNotMatch(
      page,
      /filterComercios\(\s*all,\s*state\.filters,\s*state\.leadKeys/,
    );
    assert.match(
      page,
      /filterComercios\(\s*all,\s*state\.filters,\s*activeLeadKeys/,
    );
    assert.match(page, /leadKeys=\{activeLeadKeys\}/);
  });
});

describe("Guardar como Lead — API worker", () => {
  it("POST /api/leads guarda sin duplicar y GET lista", async () => {
    const { db, places, leads } = fakeLeadDb();
    const env = assetEnv(db);
    const body = { comercios: [comercio("api-a"), comercio("api-b")] };
    const post = (payload: unknown) =>
      worker.fetch(
        new Request("https://admin.test/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }),
        env,
      );
    const created = await post(body);
    assert.equal(created.status, 201);
    const createdJson = (await created.json()) as { leads: Lead[] };
    assert.equal(createdJson.leads.length, 2);
    assert.ok(createdJson.leads.every((lead) => lead.status === "nuevo"));
    const again = await post(body);
    assert.equal(again.status, 201);
    assert.equal(((await again.json()) as { leads: Lead[] }).leads.length, 2);
    assert.equal(leads.size, 2);
    assert.equal(places.size, 2);
    const listed = await worker.fetch(
      new Request("https://admin.test/api/leads"),
      env,
    );
    assert.equal(listed.status, 200);
    assert.equal(((await listed.json()) as { leads: Lead[] }).leads.length, 2);
  });

  it("POST /api/leads 400 si JSON inválido o sin comercios", async () => {
    const env = assetEnv({
      prepare() {
        throw new Error("db_unused");
      },
    });
    const badJson = await worker.fetch(
      new Request("https://admin.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      env,
    );
    assert.equal(badJson.status, 400);
    assert.deepEqual(await badJson.json(), { error: "invalid_json" });
    const empty = await worker.fetch(
      new Request("https://admin.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comercios: [] }),
      }),
      env,
    );
    assert.equal(empty.status, 400);
    assert.deepEqual(await empty.json(), { error: "empty_selection" });
  });
});
