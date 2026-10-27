import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { readDistHtmlPages } from "./dist.ts";

const distDir = fileURLToPath(new URL("../../dist/", import.meta.url));

const GLUED_BEFORE_ANCHOR = /([A-Za-zÁÉÍÓÚÜáéíóúüÑñ0-9)])<a\b/g;

describe("espacios antes de enlaces y mails en el dist", () => {
  it("no pega letra, dígito ni ) inmediatamente antes de un <a>", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages()) {
      const html = readFileSync(join(distDir, page.relativePath), "utf8");
      for (const match of html.matchAll(GLUED_BEFORE_ANCHOR)) {
        const ch = match[1] ?? "";
        const at = match.index ?? 0;
        const after = html.slice(at, Math.min(html.length, at + 80));
        const hrefMatch = /^.<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(
          after,
        );
        const href = hrefMatch?.[2] ?? hrefMatch?.[3] ?? "";
        const snippet = html
          .slice(Math.max(0, at - 28), Math.min(html.length, at + 56))
          .replace(/\s+/g, " ");
        problems.push(
          `dist/${page.relativePath} ruta ${page.route} pegado=${JSON.stringify(ch)} href=${JSON.stringify(href)} …${snippet}…`,
        );
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});
