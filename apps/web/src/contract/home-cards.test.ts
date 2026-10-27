import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDistPage } from "./dist.ts";

function isTrabajoHref(href: string): boolean {
  return href === "/trabajo" || href.startsWith("/trabajo/");
}

describe("cards de trabajo en la home", () => {
  it("renderiza exactamente 4 cards en dist/index.html", () => {
    const cards = readDistPage("index.html").querySelectorAll("li.work-card");
    assert.equal(
      cards.length,
      4,
      `dist/index.html tiene ${cards.length} cards de trabajo; la home muestra 4`,
    );
  });

  it("la sección Trabajo no enlaza a /trabajo fuera de las 4 cards", () => {
    const section = readDistPage("index.html").querySelector("section#trabajo");
    assert.ok(section, "falta section#trabajo en dist/index.html");
    const offenders = [...section.querySelectorAll("a")].filter((anchor) => {
      const href = (anchor.getAttribute("href") ?? "").trim();
      if (!isTrabajoHref(href)) return false;
      return !anchor.closest("li.work-card");
    });
    assert.equal(
      offenders.length,
      0,
      `section#trabajo tiene ${offenders.length} enlace(s) a /trabajo fuera de las cards: ${offenders
        .map((anchor) => {
          const href = anchor.getAttribute("href") ?? "";
          const text = anchor.text.trim().replace(/\s+/g, " ");
          return `${JSON.stringify(href)} «${text}»`;
        })
        .join("; ")}`,
    );
  });
});
