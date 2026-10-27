import { expect, test } from "@playwright/test";
import { leerRutasPublicas, rutasEsperadas } from "./rutas-publicas.ts";

const rutasPublicas = leerRutasPublicas();

const ESPERA_MS = 2000;

function esRequestDeAnalytics(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname;
  if (path === "/ingest" || path.startsWith("/ingest/")) return true;
  return parsed.hostname.toLowerCase().includes("posthog");
}

function describirRequest(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function esCookieDeAnalytics(name: string): boolean {
  const valor = name.toLowerCase();
  return (
    valor.includes("posthog") ||
    valor.startsWith("ph_") ||
    valor.startsWith("phc_") ||
    valor.includes("analytics")
  );
}

test("el recorrido cubre las páginas públicas", () => {
  for (const ruta of rutasEsperadas) {
    expect(rutasPublicas, ruta).toContain(ruta);
  }
  expect(rutasPublicas.includes("/404")).toBe(false);
});

for (const ruta of rutasPublicas) {
  test(`${ruta} no pide /ingest ni PostHog y no guarda cookies de analytics`, async ({
    page,
  }) => {
    const pedidos: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!esRequestDeAnalytics(url)) return;
      pedidos.push(describirRequest(url));
    });

    const response = await page.goto(ruta, { waitUntil: "load" });
    expect(response?.ok(), ruta).toBe(true);
    await page.waitForTimeout(ESPERA_MS);

    expect(pedidos, pedidos.join("\n")).toEqual([]);

    const nombres = (await page.context().cookies())
      .map((cookie) => cookie.name)
      .filter(esCookieDeAnalytics);
    expect(nombres).toEqual([]);
  });
}
