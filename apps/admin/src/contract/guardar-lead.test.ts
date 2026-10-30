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
import {
  createD1LeadRepository,
  type D1PreparedStatement,
} from "@/leads/d1-lead-repository";
import type { D1DatabaseLike } from "@/d1-search-area-repository";
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

describe("Guardar como Lead — dominio", () => {
  it("estado inicial absoluto es nuevo y el catálogo lo incluye primero", () => {
    assert.equal(INITIAL_LEAD_STATUS, "nuevo");
    assert.equal(LEAD_STATUSES[0], "nuevo");
    assert.deepEqual(
      [...LEAD_STATUSES],
      ["nuevo", "contactado", "interesado", "descartado"],
    );
    const lead = createLeadFromComercio(comercio("a"), {
      now: "2026-10-30T12:00:00.000Z",
    });
    assert.equal(lead.status, "nuevo");
    assert.notEqual(lead.status, "contactado");
    assert.notEqual(lead.status, "interesado");
    assert.notEqual(lead.status, "descartado");
    assert.equal(lead.notes, "");
    assert.equal(lead.assignee, null);
    assert.equal(leadKey(lead), "osm:a");
  });

  it("no duplica por source + external_id al guardar de nuevo", () => {
    const a = comercio("a");
    const b = comercio("b");
    const first = saveSelectionAsLeads([a, b], [], "2026-10-30T12:00:00.000Z");
    assert.equal(first.created.length, 2);
    assert.equal(first.reused.length, 0);
    assert.equal(first.all.length, 2);
    assert.ok(first.created.every((lead) => lead.status === "nuevo"));
    const second = saveSelectionAsLeads(
      [a, b, a],
      first.all,
      "2026-10-30T13:00:00.000Z",
    );
    assert.equal(second.created.length, 0);
    assert.equal(second.reused.length, 2);
    assert.equal(second.all.length, 2);
    assert.equal(second.reused[0]?.id, first.created[0]?.id);
    assert.equal(second.reused[0]?.status, "nuevo");
    const merged = mergeLeadsByIdentity(first.all, second.reused);
    assert.equal(merged.length, 2);
  });

  it("memory repo: segundo save no agrega filas y reutiliza identidad", async () => {
    const repo = createMemoryLeadRepository({
      now: "2026-10-30T12:00:00.000Z",
    });
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
  it("migración declara places UNIQUE(source,external_id) y leads status nuevo", () => {
    const sql = readFileSync(
      join(adminRoot, "migrations/0002_places_leads.sql"),
      "utf8",
    );
    assert.match(sql, /CREATE TABLE IF NOT EXISTS places/);
    assert.match(sql, /UNIQUE\s*\(\s*source\s*,\s*external_id\s*\)/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS leads/);
    assert.match(
      sql,
      /status TEXT NOT NULL CHECK \(status IN \('nuevo', 'contactado', 'interesado', 'descartado'\)\)/,
    );
    assert.doesNotMatch(sql, /google/i);
  });

  it("D1 fake: upsert place + lead sin duplicar source+external_id", async () => {
    const places = new Map<string, Record<string, unknown>>();
    const leads = new Map<string, Record<string, unknown>>();
    let bound: unknown[] = [];
    let lastSql = "";

    function placeKey(source: unknown, externalId: unknown) {
      return `${String(source)}:${String(externalId)}`;
    }

    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async all<T = Record<string, unknown>>() {
        if (lastSql.includes("FROM leads INNER JOIN places")) {
          const rows: Record<string, unknown>[] = [];
          for (const lead of leads.values()) {
            const place = [...places.values()].find(
              (p) => p.id === lead.place_id,
            );
            if (!place) continue;
            rows.push({ ...place, ...lead, place_id: lead.place_id });
          }
          return { results: rows as T[] };
        }
        return { results: [...places.values()] as T[] };
      },
      async first<T = Record<string, unknown>>() {
        if (lastSql.includes("FROM places WHERE source")) {
          const row = places.get(placeKey(bound[0], bound[1]));
          return (row as T) ?? null;
        }
        if (
          lastSql.includes("FROM leads INNER JOIN places") &&
          lastSql.includes("WHERE places.id")
        ) {
          const placeId = String(bound[0]);
          const lead = [...leads.values()].find((l) => l.place_id === placeId);
          const place = [...places.values()].find((p) => p.id === placeId);
          if (!lead || !place) return null;
          return { ...place, ...lead, place_id: lead.place_id } as T;
        }
        return null;
      },
      async run() {
        if (lastSql.includes("INSERT INTO places")) {
          const source = String(bound[1]);
          const externalId = String(bound[2]);
          const key = placeKey(source, externalId);
          const existing = places.get(key);
          places.set(key, {
            id: existing?.id ?? bound[0],
            source,
            external_id: externalId,
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
          return {};
        }
        if (lastSql.includes("INSERT INTO leads")) {
          const placeId = String(bound[1]);
          const existing = [...leads.values()].find(
            (l) => l.place_id === placeId,
          );
          if (existing) return {};
          leads.set(String(bound[0]), {
            id: bound[0],
            place_id: placeId,
            status: bound[2],
            notes: bound[3],
            assignee: bound[4],
            created_at: bound[5],
            updated_at: bound[6],
          });
          return {};
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
      createLeadFromComercio(list[0]!, { now: "2026-10-30T12:00:00.000Z" }),
      createLeadFromComercio(list[1]!, { now: "2026-10-30T12:00:00.000Z" }),
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
    const lead = createLeadFromComercio(comercio("x"), {
      now: "2026-10-30T12:00:00.000Z",
    });
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

  it("UI: botón Guardar como Lead, disabled sin selección, hidrata leads", () => {
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
    assert.match(page, /type:\s*"leadsHydrated"[\s\S]*leads:\s*loadedLeads/);
    assert.match(shell, /setLeadsClient/);
    assert.match(shell, /getLeadsClient/);
    assert.match(shell, /loadedLeads=/);
  });
});

describe("Guardar como Lead — API worker", () => {
  it("POST /api/leads guarda sin duplicar y GET lista", async () => {
    const places = new Map<string, Record<string, unknown>>();
    const leads = new Map<string, Record<string, unknown>>();
    let bound: unknown[] = [];
    let lastSql = "";
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async all<T = Record<string, unknown>>() {
        const rows: Record<string, unknown>[] = [];
        for (const lead of leads.values()) {
          const place = [...places.values()].find(
            (p) => p.id === lead.place_id,
          );
          if (!place) continue;
          rows.push({ ...place, ...lead, place_id: lead.place_id });
        }
        return { results: rows as T[] };
      },
      async first<T = Record<string, unknown>>() {
        if (lastSql.includes("FROM places WHERE source")) {
          return (
            (places.get(`${String(bound[0])}:${String(bound[1])}`) as T) ?? null
          );
        }
        if (lastSql.includes("WHERE places.id")) {
          const placeId = String(bound[0]);
          const lead = [...leads.values()].find((l) => l.place_id === placeId);
          const place = [...places.values()].find((p) => p.id === placeId);
          if (!lead || !place) return null;
          return { ...place, ...lead, place_id: lead.place_id } as T;
        }
        return null;
      },
      async run() {
        if (lastSql.includes("INSERT INTO places")) {
          const key = `${String(bound[1])}:${String(bound[2])}`;
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
          return {};
        }
        if (lastSql.includes("INSERT INTO leads")) {
          const placeId = String(bound[1]);
          if ([...leads.values()].some((l) => l.place_id === placeId)) {
            return {};
          }
          leads.set(String(bound[0]), {
            id: bound[0],
            place_id: placeId,
            status: bound[2],
            notes: bound[3],
            assignee: bound[4],
            created_at: bound[5],
            updated_at: bound[6],
          });
          return {};
        }
        return {};
      },
    };
    const env: AdminWorkerEnv = {
      DB: {
        prepare(query: string) {
          lastSql = query;
          return stmt;
        },
      },
      ASSETS: { fetch: async () => new Response("asset") },
    };
    const body = {
      comercios: [comercio("api-a"), comercio("api-b")],
    };
    const created = await worker.fetch(
      new Request("https://admin.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    );
    assert.equal(created.status, 201);
    const createdJson = (await created.json()) as { leads: Lead[] };
    assert.equal(createdJson.leads.length, 2);
    assert.ok(createdJson.leads.every((lead) => lead.status === "nuevo"));
    const again = await worker.fetch(
      new Request("https://admin.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    );
    assert.equal(again.status, 201);
    const againJson = (await again.json()) as { leads: Lead[] };
    assert.equal(againJson.leads.length, 2);
    assert.equal(leads.size, 2);
    assert.equal(places.size, 2);
    const listed = await worker.fetch(
      new Request("https://admin.test/api/leads"),
      env,
    );
    assert.equal(listed.status, 200);
    const listedJson = (await listed.json()) as { leads: Lead[] };
    assert.equal(listedJson.leads.length, 2);
  });

  it("POST /api/leads 400 si JSON inválido o sin comercios", async () => {
    const env: AdminWorkerEnv = {
      DB: {
        prepare() {
          throw new Error("db_unused");
        },
      },
      ASSETS: { fetch: async () => new Response("asset") },
    };
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
