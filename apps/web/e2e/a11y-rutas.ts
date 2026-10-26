import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { workProjects } from "../src/data/work.ts";

export type ExcepcionAxe = {
  id: string;
  razon: string;
};

export const excepcionesAxe: ExcepcionAxe[] = [];

export const etiquetasAxe = ["wcag2a", "wcag2aa", "wcag21aa"] as const;

export const temas = [
  { nombre: "claro", valor: "light" },
  { nombre: "oscuro", valor: "dark" },
] as const;

export const viewports = [
  { nombre: "escritorio", width: 1280, height: 720 },
  { nombre: "movil", width: 390, height: 844 },
] as const;

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

const estaticas = rutasDePaginas(pagesDir, "");
const casos = workProjects.map((project) => project.href);

export const rutasPublicas = [...new Set([...estaticas, ...casos])].sort(
  compararRutas,
);
