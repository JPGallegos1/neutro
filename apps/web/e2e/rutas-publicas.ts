import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { workProjects } from "../src/data/work.ts";

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/pages");
const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function sinBarraFinal(ruta: string): string {
  if (ruta === "/") return "/";
  const sin = ruta.replace(/\/+$/, "");
  if (sin === "" || sin === "/") return "/";
  return sin;
}

function rutaDeHtml(relativo: string): string {
  const posix = relativo.split(sep).join("/");
  let path = posix;
  if (path.endsWith("/index.html")) {
    path = path.slice(0, -"index.html".length);
  } else if (path.endsWith(".html")) {
    path = path.slice(0, -".html".length);
  }
  if (path === "index" || path === "") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  return sinBarraFinal(path);
}

function compararRutas(a: string, b: string): number {
  if (a === "/") return -1;
  if (b === "/") return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function listarRelativos(dir: string): string[] {
  const relativos: string[] = [];
  const walk = (actual: string): void => {
    for (const entry of readdirSync(actual, { withFileTypes: true })) {
      const path = join(actual, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      relativos.push(relative(dir, path).split(sep).join("/"));
    }
  };
  try {
    walk(dir);
  } catch (error) {
    if (isEnoent(error)) {
      throw new Error(
        `falta ${dir}. Las rutas e2e salen del HTML de astro build (build.format: file).`,
      );
    }
    throw error;
  }
  return relativos;
}

export function leerRutasPublicas(dir = distDir): string[] {
  const rutas: string[] = [];
  for (const relativo of listarRelativos(dir)) {
    if (!relativo.endsWith(".html")) continue;
    const ruta = rutaDeHtml(relativo);
    if (ruta === "/404") continue;
    rutas.push(ruta);
  }
  return [...new Set(rutas)].sort(compararRutas);
}

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

export const rutasEsperadas = [
  ...new Set([
    ...rutasDePaginas(pagesDir, ""),
    ...workProjects.map((project) => project.href),
  ]),
]
  .map(sinBarraFinal)
  .sort(compararRutas);
