import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { ADMIN_INITIAL_STATE, adminReducer } from "@/admin-machine";
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
  leadMapsUrl,
  leadWhatsAppUrl,
  updateLeadFields,
  type Lead,
  type LeadStatus,
} from "@/leads/lead";
import worker, { type AdminWorkerEnv } from "../../worker/index";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  const pk = (s: unknown, e: unknown) => `${s}:${e}`;
  const join = (placeId: string) => {
    const row = [...leads.values()].find((l) => l.place_id === placeId);
    const place = [...places.values()].find((p) => p.id === placeId);
    return row && place ? { ...place, ...row, place_id: row.place_id } : null;
  };
  const stmt: D1PreparedStatement = {
    bind(...v: unknown[]) {
      bound = v;
      return stmt;
    },
    async all<T = Record<string, unknown>>() {
      return {
        results: [...leads.values()]
          .map((l) => join(String(l.place_id)))
          .filter(Boolean) as T[],
      };
    },
    async first<T = Record<string, unknown>>() {
      if (lastSql.includes("FROM places WHERE source")) {
        return (places.get(pk(bound[0], bound[1])) as T) ?? null;
      }
      if (lastSql.includes("WHERE places.id")) return join(String(bound[0])) as T | null;
      if (lastSql.includes("WHERE leads.id")) {
        const found = leads.get(String(bound[0]));
        return found ? (join(String(found.place_id)) as T | null) : null;
      }
      return null;
    },
    async run() {
      if (lastSql.includes("INSERT INTO places")) {
        const key = pk(bound[1], bound[2]);
        const ex = places.get(key);
        places.set(key, {
          id: ex?.id ?? bound[0], source: bound[1], external_id: bound[2], name: bound[3],
          lat: bound[4], lng: bound[5], website: bound[6], address: bound[7],
          social_urls_json: bound[8], rubro: bound[9], attribution: bound[10],
          created_at: ex?.created_at ?? bound[11], updated_at: bound[12],
        });
      } else if (lastSql.includes("INSERT INTO leads")) {
        if (![...leads.values()].some((l) => l.place_id === bound[1])) {
          leads.set(String(bound[0]), {
            id: bound[0], place_id: bound[1], status: bound[2], notes: bound[3],
            assignee: bound[4], created_at: bound[5], updated_at: bound[6],
          });
        }
      } else if (lastSql.includes("UPDATE leads SET")) {
        const id = String(bound.at(-1));
        const cur = leads.get(id);
        if (!cur) return {};
        let i = 0;
        const next = { ...cur };
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
      prepare(q: string) {
        lastSql = q;
        sqlLog.push(q);
        return stmt;
      },
    } satisfies D1DatabaseLike,
    places,
    leads,
    sqlLog,
  };
}

const envOf = (db: D1DatabaseLike): AdminWorkerEnv => ({
  DB: db,
  ASSETS: { fetch: async () => new Response("asset") },
});

describe("Vista Leads", () => {
  it("dominio + Access + Maps/WhatsApp", () => {
    const list = [lead("a"), lead("b", "contactado"), lead("c", "interesado"), lead("d", "descartado"), lead("e")];
    assert.equal(filterLeadsByStatus(list, "todos").length, 5);
    assert.equal(filterLeadsByStatus(list, "nuevo").length, 2);
    assert.deepEqual([...LEAD_STATUSES], ["nuevo", "contactado", "interesado", "descartado"]);
    const next = updateLeadFields(
      lead("x"),
      { status: "contactado", notes: "Pasé", assignee: "neutrosolutions26@gmail.com" },
      "2026-10-30T16:00:00.000Z",
    );
    assert.deepEqual([next.status, next.notes, next.assignee, next.name], ["contactado", "Pasé", "neutrosolutions26@gmail.com", "Comercio x"]);
    const maps = leadMapsUrl(next);
    const wa = leadWhatsAppUrl(next);
    assert.match(maps, /^https:\/\/www\.google\.com\/maps.*-32\.9442.*-60\.6505/);
    assert.match(wa, /^https:\/\/wa\.me\/.*text=/);
    assert.doesNotMatch(maps + wa, /neutro\.solutions/);
    assert.equal(
      accessEmailFromHeaders(new Headers({ "Cf-Access-Authenticated-User-Email": " NeutroSolutions26@gmail.com " })),
      "neutrosolutions26@gmail.com",
    );
    assert.equal(accessEmailFromHeaders(new Headers()), null);
    const jwt = `h.${Buffer.from(JSON.stringify({ email: "ops@neutro.solutions" })).toString("base64url")}.s`;
    assert.equal(accessEmailFromJwtPayload(jwt), "ops@neutro.solutions");
    assert.equal(accessEmailFromJwtPayload("nope"), null);
  });

  it("D1: google live no muta places; update solo leads", async () => {
    const { db, places, leads, sqlLog } = fakeLeadDb();
    const repo = createD1LeadRepository(db);
    await repo.saveFromComercios([comercio("g1")]);
    const before = [...places.values()][0]!;
    const live = await createFixtureGoogleLiveClient().fetchForLead({
      name: String(before.name),
      lat: Number(before.lat),
      lng: Number(before.lng),
    });
    assert.ok(live && /Google/.test(live.displayName) && live.displayName !== before.name);
    assert.deepEqual([[...places.values()][0]!.name, [...places.values()][0]!.address], [before.name, before.address]);
    assert.ok(googleLiveDoesNotTouchPlaces());
    const [saved] = await repo.saveFromComercios([comercio("u1")]);
    const updated = await repo.update(saved!.id, {
      status: "interesado",
      notes: "Llamar",
      assignee: "neutrosolutions26@gmail.com",
    });
    assert.deepEqual([updated.status, updated.notes, updated.assignee], ["interesado", "Llamar", "neutrosolutions26@gmail.com"]);
    assert.equal([...places.values()].find((p) => p.external_id === "u1")!.name, "Comercio u1");
    assert.equal(leads.size, 2);
    assert.ok(sqlLog.some((s) => /UPDATE leads SET/.test(s)) && sqlLog.every((s) => !/UPDATE places SET/.test(s)));
    const mem = createMemoryLeadRepository({ now: NOW });
    const [m] = await mem.saveFromComercios([comercio("m1")]);
    await mem.update(m!.id, { status: "contactado", notes: "ok" });
    assert.equal((await mem.list())[0]?.notes, "ok");
  });

  it("machine + UI: seeds, notes anti-clobber, Access UI", () => {
    const items = [lead("a"), lead("b", "contactado")];
    let state = adminReducer(ADMIN_INITIAL_STATE, {
      type: "leadsHydrated",
      leads: items,
      revision: 1,
    });
    state = adminReducer(state, { type: "setLeadsStatusFilter", filter: "nuevo" });
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
    assert.equal(adminReducer(state, { type: "leadsHydrated", leads: [], revision: 3 }), state);
    const seeded = adminReducer(ADMIN_INITIAL_STATE, {
      type: "selectLead",
      id: items[0]!.id,
      seed: { leads: items, revision: 7 },
    });
    assert.equal(seeded.leadsStatus, "ready");
    let ns = adminReducer(seeded, {
      type: "leadNotesChanged",
      id: items[0]!.id,
      notes: "borrador nuevo",
    });
    ns = adminReducer(ns, {
      type: "updateLeadSucceeded",
      lead: updateLeadFields(items[0]!, { status: "contactado", notes: "nota vieja" }),
      revision: Date.now(),
    });
    assert.equal(ns.leads.find((l) => l.id === items[0]!.id)?.notes, "borrador nuevo");
    assert.equal(ns.leads.find((l) => l.id === items[0]!.id)?.status, "contactado");
    ns = adminReducer(ns, { type: "leadNotesChanged", id: items[0]!.id, notes: "más nuevo" });
    const stale = adminReducer(ns, {
      type: "updateLeadSucceeded",
      lead: updateLeadFields(items[0]!, { notes: "borrador nuevo" }),
      revision: Date.now(),
      committedNotes: "borrador nuevo",
    });
    assert.equal(stale.leads.find((l) => l.id === items[0]!.id)?.notes, "más nuevo");
    assert.equal(
      adminReducer(stale, {
        type: "updateLeadSucceeded",
        lead: updateLeadFields(items[0]!, { notes: "x" }),
        revision: stale.leadsRevision,
      }),
      stale,
    );
    const machine = readFileSync(join(srcRoot, "admin-machine.ts"), "utf8");
    assert.match(machine, /case "updateLeadSucceeded":[\s\S]*committedNotes !== current/);
    const page = readFileSync(join(srcRoot, "leads/leads-page.tsx"), "utf8");
    const shell = readFileSync(join(srcRoot, "admin-shell.tsx"), "utf8");
    const clientSrc = readFileSync(join(srcRoot, "leads/leads-client.ts"), "utf8");
    assert.match(shell, /LeadsPage/);
    for (const t of [
      "data-admin-leads-page", "data-admin-leads-list", "data-admin-leads-count",
      "data-admin-leads-filter", "data-admin-lead-ficha", "data-admin-lead-status",
      "data-admin-lead-notes", "data-admin-lead-assignee", "data-admin-lead-maps",
      "data-admin-lead-whatsapp", "data-admin-google-live", "Vista en vivo (Google Places)",
      'target="_blank"', 'rel="noreferrer"', "getLeadsClient().update", "assignAccessUser: true",
    ]) {
      assert.ok(page.includes(t), t);
    }
    assert.doesNotMatch(page, /body\.assignee\s*=|getAccessMeClient|assignee:\s*me\.email/);
    assert.match(page, /body\.assignAccessUser\s*=\s*true/);
    assert.match(clientSrc, /assignee:\s*_drop[\s\S]*JSON\.stringify\(safe\)/);
    assert.doesNotMatch(page, /\buseState\b|\buseEffect\b|type:\s*"leadsHydrated"/);
    const fn = (name: string) => {
      const m = new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n  \\}`).exec(page);
      assert.ok(m, `falta ${name}`);
      return m[0]!;
    };
    assert.match(fn("onSelect"), /type:\s*"selectLead"[\s\S]*seed:\s*\{\s*leads:\s*loadedLeads/);
    assert.match(fn("persist"), /type:\s*"updateLeadRequested"[\s\S]*seed:\s*\{\s*leads:\s*loadedLeads/);
    assert.match(fn("onNotes"), /type:\s*"selectLead"[\s\S]*seed:\s*\{\s*leads:\s*loadedLeads/);
    const renderish = page
      .replace(/async function[\s\S]*?\n  \}/g, "")
      .replace(/function on[A-Z][\s\S]*?\n  \}/g, "");
    assert.doesNotMatch(renderish, /dispatch\(\{\s*type:\s*"leadsHydrated"/);
  });

  it("API: PATCH, /api/me, google-live; 404/400", async () => {
    const { db, places } = fakeLeadDb();
    const env = envOf(db);
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
    const forgedOnly = await worker.fetch(
      new Request(`https://admin.test/api/leads/${leads[0]!.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignee: "forged@evil.test" }),
      }),
      env,
    );
    assert.equal(forgedOnly.status, 400);
    const forgedWithNotes = await worker.fetch(
      new Request(`https://admin.test/api/leads/${leads[0]!.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: "ok", assignee: "forged@evil.test" }),
      }),
      env,
    );
    assert.equal(forgedWithNotes.status, 400);
    assert.deepEqual(await forgedWithNotes.json(), { error: "assignee_via_access_only" });
    const listed = ((await (
      await worker.fetch(new Request("https://admin.test/api/leads"), env)
    ).json()) as { leads: Lead[] }).leads[0];
    assert.equal(listed?.assignee, "neutrosolutions26@gmail.com");
    const workerSrc = readFileSync(join(srcRoot, "../worker/index.ts"), "utf8");
    assert.match(workerSrc, /"assignee" in body[\s\S]*assignee_via_access_only/);
    assert.match(workerSrc, /assignAccessUser[\s\S]*resolveAccessEmail/);
    assert.doesNotMatch(workerSrc, /patch\.assignee\s*=\s*body\.assignee/);
    await createD1LeadRepository(db).saveFromComercios([comercio("live")]);
    const before = structuredClone([...places.values()]);
    assert.deepEqual(
      await (
        await worker.fetch(
          new Request("https://admin.test/api/me", {
            headers: { "Cf-Access-Authenticated-User-Email": "ops@neutro.solutions" },
          }),
          env,
        )
      ).json(),
      { email: "ops@neutro.solutions" },
    );
    const live = await worker.fetch(
      new Request("https://admin.test/api/google-live?lat=-32.9442&lng=-60.6505&name=x"),
      env,
    );
    assert.equal(live.status, 200);
    assert.match(((await live.json()) as { live: { displayName: string } }).live.displayName, /Google/i);
    assert.deepEqual([...places.values()], before);
    const emptyStmt = { bind() { return this; }, async all() { return { results: [] }; }, async first() { return null; }, async run() { return {}; } };
    const empty = envOf({ prepare: () => emptyStmt });
    const patch = (path: string, body: string) =>
      worker.fetch(
        new Request(`https://admin.test/api/leads/${path}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body,
        }),
        empty,
      );
    assert.equal((await patch("nope", JSON.stringify({ notes: "x" }))).status, 404);
    assert.equal((await patch("x", "{")).status, 400);
  });
});
