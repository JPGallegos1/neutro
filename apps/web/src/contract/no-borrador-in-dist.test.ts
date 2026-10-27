import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".xml",
  ".txt",
  ".js",
  ".css",
  ".json",
  ".webmanifest",
]);

const ALLOWED_BORRADOR_PATHS: ReadonlySet<string> = new Set();

const BORRADOR_WORD = /\bborrador\b/iu;

type DistTextFile = {
  relativePath: string;
  content: string;
};

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function normalizeText(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0*160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\n\r\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .toLocaleLowerCase("es-AR");
}

function containsBorrador(value: string): boolean {
  return BORRADOR_WORD.test(normalizeText(value));
}

function walkFiles(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(path, files);
      continue;
    }
    if (entry.isFile()) files.push(path);
  }
}

function listDistTextFiles(): DistTextFile[] {
  const files: string[] = [];
  walkFiles(distDir, files);
  return files
    .map((path) => toPosix(relative(distDir, path)))
    .filter((relativePath) => {
      const lower = relativePath.toLowerCase();
      const dot = lower.lastIndexOf(".");
      if (dot === -1) return false;
      return TEXT_EXTENSIONS.has(lower.slice(dot));
    })
    .sort((a, b) => a.localeCompare(b))
    .map((relativePath) => ({
      relativePath,
      content: readFileSync(join(distDir, relativePath), "utf8"),
    }));
}

function borradorProblems(files: DistTextFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    if (ALLOWED_BORRADOR_PATHS.has(file.relativePath)) continue;
    if (!containsBorrador(file.content)) continue;
    const match = normalizeText(file.content).match(BORRADOR_WORD);
    problems.push(
      `dist/${file.relativePath} hit=${JSON.stringify(match?.[0] ?? "borrador")}`,
    );
  }
  return problems;
}

function assertNoBorrador(files: DistTextFile[]): void {
  const problems = borradorProblems(files);
  assert.deepEqual(problems, [], problems.join("\n"));
}

function withReplaced(
  files: DistTextFile[],
  relativePath: string,
  content: string,
): DistTextFile[] {
  let found = false;
  const next = files.map((file) => {
    if (file.relativePath !== relativePath) return file;
    found = true;
    return { relativePath, content };
  });
  assert.ok(found, `no está dist/${relativePath} en el listado del contrato`);
  return next;
}

function mutateHtml(
  html: string,
  relativePath: string,
  mutate: (source: string) => string,
): string {
  const next = mutate(html);
  assert.notEqual(next, html, `no se pudo mutar dist/${relativePath}`);
  assert.ok(
    containsBorrador(next),
    `la mutación de dist/${relativePath} no introdujo «borrador»`,
  );
  return next;
}

describe("sin «borrador» en archivos de texto del dist", () => {
  it("no contiene la palabra borrador en html/xml/txt/js/css/json/webmanifest", () => {
    assert.equal(ALLOWED_BORRADOR_PATHS.size, 0);
    const files = listDistTextFiles();
    assert.ok(files.some((file) => file.relativePath.endsWith(".html")));
    assert.ok(files.some((file) => file.relativePath.endsWith(".xml")));
    assert.ok(files.some((file) => file.relativePath === "robots.txt"));
    assert.ok(files.some((file) => file.relativePath.endsWith(".js")));
    assert.ok(files.some((file) => file.relativePath.endsWith(".css")));
    assertNoBorrador(files);
  });

  it("falla si «Borrador de contenido» aparece en la home", () => {
    const files = listDistTextFiles();
    const html = files.find((file) => file.relativePath === "index.html");
    assert.ok(html);
    const mutated = mutateHtml(html.content, "index.html", (source) =>
      source.replace("<main", "<main data-x><p>Borrador de contenido</p"),
    );
    assert.throws(
      () => assertNoBorrador(withReplaced(files, "index.html", mutated)),
      /index\.html/,
    );
  });

  it("falla si aparece solo «Borrador» en texto visible", () => {
    const files = listDistTextFiles();
    const html = files.find((file) => file.relativePath === "nosotros.html");
    assert.ok(html);
    const mutated = mutateHtml(html.content, "nosotros.html", (source) =>
      source.replace("<main", "<main data-x><p>Borrador</p"),
    );
    assert.throws(
      () => assertNoBorrador(withReplaced(files, "nosotros.html", mutated)),
      /nosotros\.html/,
    );
  });

  it("falla si aparece en mayúsculas, con espacios múltiples o &nbsp;", () => {
    const files = listDistTextFiles();
    const html = files.find((file) => file.relativePath === "nosotros.html");
    assert.ok(html);
    for (const snippet of [
      "<p>BORRADOR DE CONTENIDO</p>",
      "<p>Borrador  de   contenido</p>",
      "<p>Borrador&nbsp;de&#160;contenido</p>",
    ]) {
      const mutated = mutateHtml(html.content, "nosotros.html", (source) =>
        source.replace("<main", `<main data-x>${snippet}`),
      );
      assert.throws(
        () => assertNoBorrador(withReplaced(files, "nosotros.html", mutated)),
        /nosotros\.html/,
      );
    }
  });

  it("falla si aparece en aria-label, alt o title de atributo", () => {
    const files = listDistTextFiles();
    const html = files.find((file) => file.relativePath === "index.html");
    assert.ok(html);
    for (const attr of [
      'aria-label="Borrador"',
      'alt="Borrador de contenido"',
      'title="BORRADOR"',
    ]) {
      const mutated = mutateHtml(html.content, "index.html", (source) =>
        source.replace("<main", `<main ${attr}`),
      );
      assert.throws(
        () => assertNoBorrador(withReplaced(files, "index.html", mutated)),
        /index\.html/,
      );
    }
  });

  it("falla si aparece en <title> o meta content", () => {
    const files = listDistTextFiles();
    const html = files.find((file) => file.relativePath === "nosotros.html");
    assert.ok(html);
    const inTitle = mutateHtml(html.content, "nosotros.html", (source) =>
      source.replace(/<title>[^<]*<\/title>/i, "<title>Borrador</title>"),
    );
    assert.throws(
      () => assertNoBorrador(withReplaced(files, "nosotros.html", inTitle)),
      /nosotros\.html/,
    );
    const inMeta = mutateHtml(html.content, "nosotros.html", (source) =>
      source.replace(
        /<meta\b[^>]*\bname=["']description["'][^>]*>/i,
        '<meta name="description" content="Borrador de contenido">',
      ),
    );
    assert.throws(
      () => assertNoBorrador(withReplaced(files, "nosotros.html", inMeta)),
      /nosotros\.html/,
    );
  });

  it("falla si aparece en JSON-LD", () => {
    const files = listDistTextFiles();
    const html = files.find((file) => file.relativePath === "index.html");
    assert.ok(html);
    const mutated = mutateHtml(html.content, "index.html", (source) =>
      source.replace(
        /<script type="application\/ld\+json">/,
        '<script type="application/ld+json">{"name":"Borrador"}',
      ),
    );
    assert.throws(
      () => assertNoBorrador(withReplaced(files, "index.html", mutated)),
      /index\.html/,
    );
  });

  it("falla si aparece en robots.txt o sitemap", () => {
    const files = listDistTextFiles();
    const robots = files.find((file) => file.relativePath === "robots.txt");
    assert.ok(robots);
    const robotsMutated = `${robots.content}\n# Borrador\n`;
    assert.ok(containsBorrador(robotsMutated));
    assert.throws(
      () => assertNoBorrador(withReplaced(files, "robots.txt", robotsMutated)),
      /robots\.txt/,
    );

    const sitemap = files.find((file) =>
      file.relativePath.toLowerCase().endsWith(".xml"),
    );
    assert.ok(sitemap);
    const sitemapMutated = sitemap.content.replace(
      "<urlset",
      '<urlset data-borrador="Borrador"',
    );
    assert.notEqual(sitemapMutated, sitemap.content);
    assert.ok(containsBorrador(sitemapMutated));
    assert.throws(
      () =>
        assertNoBorrador(
          withReplaced(files, sitemap.relativePath, sitemapMutated),
        ),
      new RegExp(sitemap.relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("falla si aparece en un .js o .css del dist", () => {
    const files = listDistTextFiles();
    const js = files.find((file) => file.relativePath.endsWith(".js"));
    const css = files.find((file) => file.relativePath.endsWith(".css"));
    assert.ok(js);
    assert.ok(css);
    assert.throws(
      () =>
        assertNoBorrador(
          withReplaced(
            files,
            js.relativePath,
            `${js.content}\n;/* Borrador */`,
          ),
        ),
      new RegExp(js.relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    assert.throws(
      () =>
        assertNoBorrador(
          withReplaced(
            files,
            css.relativePath,
            `${css.content}\n/* Borrador de contenido */`,
          ),
        ),
      new RegExp(css.relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });
});
