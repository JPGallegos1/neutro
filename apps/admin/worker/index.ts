import { searchComerciosFromFixtures, type Comercio } from "../src/comercio";
import {
  createD1SearchAreaRepository,
  type D1DatabaseLike,
} from "../src/d1-search-area-repository";
import { resolveAccessEmail } from "../src/leads/access-identity";
import { createD1LeadRepository } from "../src/leads/d1-lead-repository";
import { createFixtureGoogleLiveView } from "../src/leads/google-live";
import {
  LEAD_STATUSES,
  type LeadStatus,
  type LeadUpdatePatch,
} from "../src/leads/lead";
import {
  createSearchArea,
  type CreateSearchAreaInput,
} from "../src/search-area";

export type AdminWorkerEnv = {
  DB: D1DatabaseLike;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  FOURSQUARE_API_KEY?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export default {
  async fetch(request: Request, env: AdminWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/comercios" && request.method === "GET") {
      const latRaw = url.searchParams.get("lat");
      const lngRaw = url.searchParams.get("lng");
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      const radiusKm = Number(url.searchParams.get("radiusKm") ?? "3");
      if (
        latRaw == null ||
        lngRaw == null ||
        latRaw.trim() === "" ||
        lngRaw.trim() === "" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return json({ error: "invalid_query" }, 400);
      }
      void radiusKm;
      void env.FOURSQUARE_API_KEY;
      return json({ comercios: searchComerciosFromFixtures() });
    }
    if (url.pathname === "/api/areas" && request.method === "GET") {
      return json({ areas: await createD1SearchAreaRepository(env.DB).list() });
    }
    if (url.pathname === "/api/areas" && request.method === "POST") {
      let body: CreateSearchAreaInput;
      try {
        body = (await request.json()) as CreateSearchAreaInput;
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      const validated = createSearchArea(body);
      if (!validated.ok) return json({ error: validated.error }, 400);
      try {
        const area = await createD1SearchAreaRepository(env.DB).create({
          name: validated.value.name,
          center: validated.value.center,
          radiusKm: validated.value.radiusKm,
          shape: validated.value.shape,
          polygon: validated.value.polygon,
          id: validated.value.id,
          now: validated.value.createdAt,
        });
        return json({ area }, 201);
      } catch {
        return json({ error: "persist_failed" }, 500);
      }
    }
    if (url.pathname === "/api/leads" && request.method === "GET") {
      return json({ leads: await createD1LeadRepository(env.DB).list() });
    }
    if (url.pathname === "/api/leads" && request.method === "POST") {
      let body: { comercios?: Comercio[] };
      try {
        body = (await request.json()) as { comercios?: Comercio[] };
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      const comercios = Array.isArray(body.comercios) ? body.comercios : [];
      if (comercios.length === 0) {
        return json({ error: "empty_selection" }, 400);
      }
      try {
        const leads = await createD1LeadRepository(env.DB).saveFromComercios(
          comercios,
        );
        return json({ leads }, 201);
      } catch {
        return json({ error: "persist_failed" }, 500);
      }
    }
    if (url.pathname === "/api/me" && request.method === "GET") {
      return json({ email: resolveAccessEmail(request.headers) });
    }
    if (url.pathname === "/api/google-live" && request.method === "GET") {
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      const name = (url.searchParams.get("name") ?? "").trim() || "Comercio";
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json({ error: "invalid_query" }, 400);
      }
      return json({ live: createFixtureGoogleLiveView({ name, lat, lng }) });
    }
    const leadMatch = /^\/api\/leads\/([^/]+)$/.exec(url.pathname);
    if (leadMatch && request.method === "PATCH") {
      const id = decodeURIComponent(leadMatch[1] ?? "");
      let body: LeadUpdatePatch & { assignAccessUser?: boolean };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      const patch: LeadUpdatePatch = {};
      if (body.status !== undefined) {
        if (!(LEAD_STATUSES as readonly string[]).includes(body.status)) {
          return json({ error: "invalid_status" }, 400);
        }
        patch.status = body.status as LeadStatus;
      }
      if (body.notes !== undefined) patch.notes = String(body.notes);
      if ("assignee" in body) {
        return json({ error: "assignee_via_access_only" }, 400);
      }
      if (body.assignAccessUser) {
        patch.assignee = resolveAccessEmail(request.headers);
      }
      if (
        patch.status === undefined &&
        patch.notes === undefined &&
        patch.assignee === undefined
      ) {
        return json({ error: "empty_patch" }, 400);
      }
      try {
        return json({
          lead: await createD1LeadRepository(env.DB).update(id, patch),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "lead_not_found") {
          return json({ error: "not_found" }, 404);
        }
        return json({ error: "persist_failed" }, 500);
      }
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("x-robots-tag", "noindex, nofollow");
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
