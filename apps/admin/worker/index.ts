import { searchComerciosFromFixtures } from "../src/comercio";
import {
  createD1SearchAreaRepository,
  type D1DatabaseLike,
} from "../src/d1-search-area-repository";
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
