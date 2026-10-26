import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDistHtmlPages } from "./dist.ts";

describe("links con target=_blank en el dist", () => {
  it("exige rel con noopener y noreferrer en cada ancla", () => {
    const problems: string[] = [];
    for (const page of readDistHtmlPages()) {
      for (const anchor of page.document.querySelectorAll("a")) {
        const target = (anchor.getAttribute("target") ?? "")
          .trim()
          .toLowerCase();
        if (target !== "_blank") continue;
        const rel = anchor.getAttribute("rel") ?? "";
        const tokens = rel
          .toLowerCase()
          .split(/\s+/)
          .filter((token) => token.length > 0);
        if (tokens.includes("noopener") && tokens.includes("noreferrer")) {
          continue;
        }
        const href = anchor.getAttribute("href") ?? "";
        problems.push(
          `dist/${page.relativePath} ruta ${page.route} href=${JSON.stringify(href)} target=${JSON.stringify(anchor.getAttribute("target") ?? "")} rel=${JSON.stringify(rel)}`,
        );
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
  });
});
