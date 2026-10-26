import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readDistHtmlPages } from "../src/contract/dist.ts";
import { workProjects } from "../src/data/work.ts";

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

export const rutasEsperadas = [
  ...new Set([
    ...rutasDePaginas(pagesDir, ""),
    ...workProjects.map((project) => project.href),
  ]),
].sort(compararRutas);

export const rutasPublicas = [
  ...new Set(
    readDistHtmlPages()
      .map((page) => page.route)
      .filter((route) => route !== "/404"),
  ),
].sort(compararRutas);
