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
import { createComercio } from "@/comercio";
import type { D1DatabaseLike } from "@/d1-search-area-repository";
import {
  accessEmailFromHeaders,
  accessEmailFromJwtPayload,
} from "@/leads/access-identity";
import {
  createD1LeadRepository,
  type D1PreparedStatement,
} from "@/leads/d1-lead-repository";
import {
  createFixtureGoogleLiveClient,
  googleLiveDoesNotTouchPlaces,
} from "@/leads/google-live";
import {
  LEAD_STATUSES,
  createLeadFromComercio,
  createMemoryLeadRepository,
  filterLeadsByStatus,
  leadKey,
  leadMapsUrl,
  leadWhatsAppUrl,
  updateLeadFields,
  type Lead,
  type LeadStatus,
} from "@/leads/lead";
import worker, { type AdminWorkerEnv } from "../../worker/index";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(adminRoot, "src");
const NOW = "2026-10-30T15:00:00.000Z";

function comercio(id: string) {
  return createComercio({
    source: "osm",
    externalId: id,
    name: `Comercio ${id}`,
    lat: -32.9442,
    lng: -60.6505,
    website: null,
    address: `Calle ${id} 100`,
    socialUrls: [],
    rubro: "cafe",
  })!;
}

function lead(id: string, status: LeadStatus = "nuevo"): Lead {
  return createLeadFromComercio(comercio(id), {
    now: NOW,
    status,
    notes: "",
    assignee: null,
  });
}

function fakeLeadDb() {
  const places = new Map<string, Record<string, unknown>>();
  const leads = new Map<string, Record<string, unknown>>();
  let bound: unknown[] = [];
  let lastSql = "";
  const sqlLog: string[] = [];
  const placeKey = (s: unknown, e: unknown) => `${String(s)}:${String(e)}`;
  const joinRow = (placeId: string) => {
    const row = [...leads.values()].find((l) => l.place_id === placeId);
    const place = [...places.values()].find((p) => p.id === placeId);
    return row && place ? { ...place, ...row, place_id: row.place_id } : null;
  };
  const stmt: D1PreparedStatement = {
    bind(...values: unknown[]) {
      bound = values;
      return stmt;
    },
    async all<T = Record<string, unknown>>() {
      return {
        results: [...leads.values()]
          .map((l) => joinRow(String(l.place_id)))
          .filter(Boolean) as T[],
      };
    },
    async first<T = Record<string, unknown>>() {
      if (lastSql.includes("FROM places WHERE source")) {
        return (places.get(placeKey(bound[0], bound[1])) as T) ?? null;
      }
      if (lastSql.includes("WHERE places.id")) {
        return joinRow(String(bound[0])) as T | null;
      }
      if (lastSql.includes("WHERE leads.id")) {
        const found = leads.get(String(bound[0]));
        return found ? (joinRow(String(found.place_id)) as T | null) : null;
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
      } else if (lastSql.includes("UPDATE leads SET")) {
        const id = String(bound[bound.length - 1]);
        const current = leads.get(id);
        if (!current) return {};
        let i = 0;
        const next = { ...current };
        if (lastSql.includes("status = ?")) next.status = bound[i++];
        if (lastSql.includes("notes = ?")) next.notes = bound[i++];
        if (lastSql.includes("assignee = ?")) next.assignee = bound[i++];
        next.updated_at = bound[i++];
        leads.set(id, next);
      }
      return {};
    },
  };
  return {
    db: {
      prepare(query: string) {
        lastSql = query;
        sqlLog.push(query);
        return stmt;
      },
    } satisfies D1DatabaseLike,
    places,
    leads,
    sqlLog,
  };
}

function assetEnv(db: D1DatabaseLike): AdminWorkerEnv {
  return { DB: db, ASSETS: { fetch: async () => new Response("asset") } };
}

describe("Vista Leads — dominio seguimiento", () => {
  it("filtra por estado; actualiza estado/notas/responsable; Maps/WhatsApp externos", () => {
    const list = [
      lead("a", "nuevo"),
      lead("b", "contactado"),
      lead("c", "interesado"),
      lead("d", "descartado"),
      lead("e", "nuevo"),
    ];
    assert.equal(filterLeadsByStatus(list, "todos").length, 5);
    assert.equal(filterLeadsByStatus(list, "nuevo").length, 2);
    assert.deepEqual([...LEAD_STATUSES], [
      "nuevo",
      "contactado",
      "interesado",
      "descartado",
    ]);
    const next = updateLeadFields(
      lead("x"),
      {
        status: "contactado",
        notes: "Pasé por el local",
        assignee: "neutrosolutions26@gmail.com",
      },
      "2026-10-30T16:00:00.000Z",
    );
    assert.equal(next.status, "contactado");
    assert.equal(next.notes, "Pasé por el local");
    assert.equal(next.assignee, "neutrosolutions26@gmail.com");
    assert.equal(next.name, "Comercio x");
    assert.equal(next.address, "Calle x 100");
    assert.equal(next.updatedAt, "2026-10-30T16:00:00.000Z");
    const maps = leadMapsUrl(next);
    const wa = leadWhatsAppUrl(next);
    assert.match(maps, /^https:\/\/www\.google\.com\/maps/);
    assert.match(maps, /-32\.9442/);
    assert.match(maps, /-60\.6505/);
    assert.match(wa, /^https:\/\/wa\.me\//);
    assert.match(wa, /text=/);
    assert.doesNotMatch(maps, /neutro\.solutions/);
    assert.doesNotMatch(wa, /neutro\.solutions/);
  });
});

describe("Vista Leads — Access responsable", () => {
  it("lee email Access por header y JWT fallback", () => {
    assert.equal(
      accessEmailFromHeaders(
        new Headers({
          "Cf-Access-Authenticated-User-Email": " NeutroSolutions26@gmail.com ",
        }),
      ),
      "neutrosolutions26@gmail.com",
    );
    assert.equal(accessEmailFromHeaders(new Headers()), null);
    const payload = Buffer.from(
      JSON.stringify({ email: "ops@neutro.solutions" }),
    ).toString("base64url");
    assert.equal(accessEmailFromJwtPayload(`hdr.${payload}.sig`), "ops@neutro.solutions");
    assert.equal(accessEmailFromJwtPayload("nope"), null);
  });
});

describe("Vista Leads — Google en vivo no escribe D1", () => {
  it("live no muta places; update solo toca leads", async () => {
    const { db, places, leads, sqlLog } = fakeLeadDb();
    const repo = createD1LeadRepository(db);
    await repo.saveFromComercios([comercio("g1")]);
    const before = [...places.values()][0]!;
    const live = await createFixtureGoogleLiveClient().fetchForLead({
      name: String(before.name),
      lat: Number(before.lat),
      lng: Number(before.lng),
    });
    assert.ok(live);
    assert.match(live.displayName, /Google/);
    assert.notEqual(live.displayName, before.name);
    assert.equal([...places.values()][0]!.name, before.name);
    assert.equal([...places.values()][0]!.address, before.address);
    assert.equal(googleLiveDoesNotTouchPlaces(), true);
    const saved = await repo.saveFromComercios([comercio("u1")]);
    const placeBefore = [...places.values()].find(
      (p) => p.external_id === "u1",
    )!;
    const updated = await repo.update(saved[0]!.id, {
      status: "interesado",
      notes: "Llamar jueves",
      assignee: "neutrosolutions26@gmail.com",
    });
    assert.equal(updated.status, "interesado");
    assert.equal(updated.notes, "Llamar jueves");
    assert.equal(updated.assignee, "neutrosolutions26@gmail.com");
    assert.equal(placeBefore.name, "Comercio u1");
    assert.equal(leads.size, 2);
    assert.ok(sqlLog.some((sql) => /UPDATE leads SET/.test(sql)));
    assert.ok(sqlLog.every((sql) => !/UPDATE places SET/.test(sql)));
    const mem = createMemoryLeadRepository({ now: NOW });
    const [created] = await mem.saveFromComercios([comercio("m1")]);
    await mem.update(created!.id, { status: "contactado", notes: "ok" });
    assert.equal((await mem.list())[0]?.notes, "ok");
  });
});

describe("Vista Leads — machine + UI sin dispatch en render", () => {
  it("filtra, selecciona, actualiza y anti-clobber; seed desde idle", () => {
    const items = [lead("a", "nuevo"), lead("b", "contactado")];
    let state: AdminState = adminReducer(ADMIN_INITIAL_STATE, {
      type: "leadsHydrated",
      leads: items,
      revision: 1,
    });
    state = adminReducer(state, { type: "setLeadsStatusFilter", filter: "nuevo" });
    assert.equal(state.leadsStatusFilter, "nuevo");
    state = adminReducer(state, { type: "selectLead", id: items[0]!.id });
    state = adminReducer(state, {
      type: "leadNotesChanged",
      id: items[0]!.id,
      notes: "Borrador",
    });
    assert.equal(state.leads.find((item) => item.id === items[0]!.id)?.notes, "Borrador");
    state = adminReducer(state, { type: "updateLeadRequested" });
    assert.equal(state.leadsStatus, "saving");
    const patched = updateLeadFields(items[0]!, {
      status: "contactado",
      notes: "Borrador",
      assignee: "neutrosolutions26@gmail.com",
    });
    state = adminReducer(state, {
      type: "updateLeadSucceeded",
      lead: patched,
      revision: 2,
    });
    assert.equal(state.leads.find((item) => item.id === patched.id)?.status, "contactado");
    assert.equal(state.leadKeys.has(leadKey(patched)), true);
    state = adminReducer(state, { type: "updateLeadRequested" });
    assert.equal(
      adminReducer(state, { type: "leadsHydrated", leads: [], revision: 200 }).leadsStatus,
      "saving",
    );
    state = adminReducer(state, {
      type: "updateLeadSucceeded",
      lead: updateLeadFields(items[0]!, { notes: "ok" }),
      revision: 3,
    });
    assert.equal(
      adminReducer(state, { type: "leadsHydrated", leads: [], revision: 3 }),
      state,
    );
    assert.equal(
      adminReducer(state, {
        type: "leadsHydrated",
        leads: [lead("z")],
        revision: 4,
      }).leads[0]?.externalId,
      "z",
    );
    const seeded = adminReducer(ADMIN_INITIAL_STATE, {
      type: "selectLead",
      id: items[0]!.id,
      seed: { leads: items, revision: 7 },
    });
    assert.equal(seeded.leadsStatus, "ready");
    assert.equal(seeded.selectedLeadId, items[0]!.id);
  });

  it("UI Leads sin hydrate/dispatch en render", () => {
    const page = readFileSync(join(srcRoot, "leads/leads-page.tsx"), "utf8");
    const shell = readFileSync(join(srcRoot, "admin-shell.tsx"), "utf8");
    assert.match(shell, /LeadsPage/);
    assert.match(shell, /path:\s*"\/leads"/);
    for (const token of [
      "data-admin-leads-page",
      "data-admin-leads-list",
      "data-admin-leads-count",
      "data-admin-leads-filter",
      "data-admin-lead-ficha",
      "data-admin-lead-status",
      "data-admin-lead-notes",
      "data-admin-lead-assignee",
      "data-admin-lead-maps",
      "data-admin-lead-whatsapp",
      "data-admin-google-live",
      "Vista en vivo (Google Places)",
      'target="_blank"',
      'rel="noreferrer"',
    ]) {
      assert.match(page, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(page, /getLeadsClient\(\)\.update/);
    assert.doesNotMatch(page, /\buseState\b|\buseEffect\b/);
    assert.doesNotMatch(page, /type:\s*"leadsHydrated"/);
    assert.doesNotMatch(page, /leadsRevision\s*!==\s*loadedLeadsRevision/);
    assert.match(
      page,
      /leadsStatus === "idle"[\s\S]*?selectLead[\s\S]*?seed:\s*\{\s*leads:\s*loadedLeads/,
    );
    const renderish = page
      .replace(/async function[\s\S]*?\n  \}/g, "")
      .replace(/function on[A-Z][\s\S]*?\n  \}/g, "");
    assert.doesNotMatch(renderish, /dispatch\(\{\s*type:\s*"leadsHydrated"/);
    assert.doesNotMatch(renderish, /if\s*\([^)]*Revision[^)]*\)\s*\{\s*dispatch/);
  });
});

describe("Vista Leads — API worker", () => {
  it("PATCH actualiza; /api/me y google-live no escriben D1", async () => {
    const { db, places } = fakeLeadDb();
    const env = assetEnv(db);
    const created = await worker.fetch(
      new Request("https://admin.test/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ comercios: [comercio("api")] }),
      }),
      env,
    );
    const { leads } = (await created.json()) as { leads: Lead[] };
    const placeName = [...places.values()][0]!.name;
    const patched = await worker.fetch(
      new Request(`https://admin.test/api/leads/${leads[0]!.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "Cf-Access-Authenticated-User-Email": "neutrosolutions26@gmail.com",
        },
        body: JSON.stringify({
          status: "contactado",
          notes: "Seguimiento",
          assignAccessUser: true,
        }),
      }),
      env,
    );
    assert.equal(patched.status, 200);
    const body = (await patched.json()) as { lead: Lead };
    assert.equal(body.lead.status, "contactado");
    assert.equal(body.lead.assignee, "neutrosolutions26@gmail.com");
    assert.equal([...places.values()][0]!.name, placeName);
    await createD1LeadRepository(db).saveFromComercios([comercio("live")]);
    const before = structuredClone([...places.values()]);
    const me = await worker.fetch(
      new Request("https://admin.test/api/me", {
        headers: { "Cf-Access-Authenticated-User-Email": "ops@neutro.solutions" },
      }),
      env,
    );
    assert.deepEqual(await me.json(), { email: "ops@neutro.solutions" });
    const live = await worker.fetch(
      new Request(
        "https://admin.test/api/google-live?lat=-32.9442&lng=-60.6505&name=Comercio%20live",
      ),
      env,
    );
    assert.equal(live.status, 200);
    assert.match(
      ((await live.json()) as { live: { displayName: string } }).live.displayName,
      /Google/i,
    );
    assert.deepEqual([...places.values()], before);
  });

  it("PATCH 404/400 en errores", async () => {
    const env = assetEnv({
      prepare() {
        return {
          bind() {
            return this;
          },
          async all() {
            return { results: [] };
          },
          async first() {
            return null;
          },
          async run() {
            return {};
          },
        };
      },
    });
    assert.equal(
      (
        await worker.fetch(
          new Request("https://admin.test/api/leads/nope", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ notes: "x" }),
          }),
          env,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://admin.test/api/leads/x", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: "{",
          }),
          env,
        )
      ).status,
      400,
    );
  });
});
