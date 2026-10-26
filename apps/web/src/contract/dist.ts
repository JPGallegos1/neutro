import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, type HTMLElement } from "node-html-parser";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

export type DistHtmlPage = {
  relativePath: string;
  route: string;
  document: HTMLElement;
};

export type SitemapLoc = {
  loc: string;
  file: string;
};

export type DistSitemaps = {
  files: string[];
  locs: SitemapLoc[];
};

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function missingDist(path: string): Error {
  return new Error(
    `falta ${path}. El contrato lee el HTML de astro build (build.format: file).`,
  );
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

export function routeFromDistHtml(relativePath: string): string {
  const posix = toPosix(relativePath);
  let path = posix;
  if (path.endsWith("/index.html")) {
    path = path.slice(0, -"index.html".length);
  } else if (path.endsWith(".html")) {
    path = path.slice(0, -".html".length);
  }
  if (path === "index" || path === "") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path;
}

export function readDistPage(filename: string): HTMLElement {
  const path = join(distDir, filename);
  try {
    return parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (isEnoent(error)) {
      throw missingDist(path);
    }
    throw error;
  }
}

function walkDist(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDist(path, files);
      continue;
    }
    if (entry.isFile()) files.push(path);
  }
}

function listDistFiles(): string[] {
  const files: string[] = [];
  try {
    walkDist(distDir, files);
  } catch (error) {
    if (isEnoent(error)) throw missingDist(distDir);
    throw error;
  }
  return files;
}

export function readDistHtmlPages(): DistHtmlPage[] {
  return listDistFiles()
    .filter((path) => path.endsWith(".html"))
    .map((path) => {
      const relativePath = toPosix(relative(distDir, path));
      return {
        relativePath,
        route: routeFromDistHtml(relativePath),
        document: parse(readFileSync(path, "utf8")),
      };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function isSitemapFile(relativePath: string): boolean {
  const base = relativePath.split("/").pop() ?? "";
  return base.startsWith("sitemap") && base.endsWith(".xml");
}

export function readDistSitemaps(): DistSitemaps {
  const xmlFiles = listDistFiles()
    .map((path) => ({
      path,
      file: toPosix(relative(distDir, path)),
    }))
    .filter((entry) => isSitemapFile(entry.file))
    .sort((a, b) => a.file.localeCompare(b.file));
  const locs: SitemapLoc[] = [];
  for (const entry of xmlFiles) {
    const document = parse(readFileSync(entry.path, "utf8"));
    for (const url of document.querySelectorAll("url")) {
      const loc = url.querySelector("loc")?.text.trim() ?? "";
      locs.push({ loc, file: entry.file });
    }
  }
  return { files: xmlFiles.map((entry) => entry.file), locs };
}
