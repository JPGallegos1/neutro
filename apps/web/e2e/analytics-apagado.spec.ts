import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { workProjects } from "../src/data/work.ts";

const ESPERA_MS = 2000;

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/pages");

function rutasDePaginas(dir: string, prefix: string): string[] {
  const rutas: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      rutas.push(
        ...rutasDePaginas(join(dir, entry.name), `${prefix}/${entry.name}`),
      );
      continue;
    }
    if (!entry.name.endsWith(".astro")) continue;
    if (entry.name === "404.astro") continue;
    const stem = entry.name.slice(0, -".astro".length);
    if (stem.startsWith("[")) continue;
    if (stem === "index") {
      rutas.push(prefix === "" ? "/" : prefix);
      continue;
    }
    rutas.push(`${prefix}/${stem}`);
  }
  return rutas;
}

function compararRutas(a: string, b: string): number {
  if (a === "/") return -1;
  if (b === "/") return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const rutasPublicas = [
  ...new Set([
    ...rutasDePaginas(pagesDir, ""),
    ...workProjects.map((project) => project.href),
  ]),
].sort(compararRutas);

const RUTAS_ESPERADAS = [
  "/",
  "/nosotros",
  "/cookies",
  "/privacidad",
  "/terminos",
  "/alerta-estafa",
  "/trabajo",
  ...workProjects.map((project) => project.href),
] as const;

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
  for (const ruta of RUTAS_ESPERADAS) {
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
