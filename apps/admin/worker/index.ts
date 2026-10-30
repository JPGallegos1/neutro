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
};

function json(data: unknown, status = 200): Response {
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

    if (url.pathname === "/api/areas" && request.method === "GET") {
      const repo = createD1SearchAreaRepository(env.DB);
      const areas = await repo.list();
      return json({ areas });
    }

    if (url.pathname === "/api/areas" && request.method === "POST") {
      let body: CreateSearchAreaInput;
      try {
        body = (await request.json()) as CreateSearchAreaInput;
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      const validated = createSearchArea(body);
      if (!validated.ok) {
        return json({ error: validated.error }, 400);
      }
      const repo = createD1SearchAreaRepository(env.DB);
      try {
        const area = await repo.create({
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

    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    headers.set("x-robots-tag", "noindex, nofollow");
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
