import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDistPage } from "./dist.ts";

describe("cards de trabajo en la home", () => {
  it("renderiza exactamente 4 cards en dist/index.html", () => {
    const cards = readDistPage("index.html").querySelectorAll("li.work-card");
    assert.equal(
      cards.length,
      4,
      `dist/index.html tiene ${cards.length} cards de trabajo; la home muestra 4`,
    );
  });
});
