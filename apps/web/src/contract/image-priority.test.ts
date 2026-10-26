import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HTMLElement } from "node-html-parser";

import { readDistPage } from "./dist.ts";

const POSTER_HREF = "/video/neutro-poster.jpg";
const CASE_DIST_PAGES = [
  "trabajo/conexion-laboral.html",
  "trabajo/afectiva.html",
  "trabajo/capa-automotores.html",
  "trabajo/suplementacion-ciencia.html",
  "trabajo/luxurycars.html",
] as const;

function cardImages(root: HTMLElement): HTMLElement[] {
  return root.querySelectorAll("img.work-card__image");
}

function posterPreloads(root: HTMLElement): HTMLElement[] {
  return root.querySelectorAll("link").filter((el) => {
    const rel = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
    return (
      rel.includes("preload") &&
      el.getAttribute("as") === "image" &&
      el.getAttribute("href") === POSTER_HREF
    );
  });
}

function assertLazyCard(img: HTMLElement, label: string): void {
  assert.equal(
    img.getAttribute("loading"),
    "lazy",
    `${label}: loading debe ser lazy`,
  );
  assert.equal(
    img.getAttribute("decoding"),
    "async",
    `${label}: decoding debe ser async`,
  );
  assert.equal(
    img.getAttribute("fetchpriority") ?? null,
    null,
    `${label}: no debe llevar fetchpriority`,
  );
}

function assertPriorityCard(img: HTMLElement, label: string): void {
  assert.equal(
    img.getAttribute("loading"),
    "eager",
    `${label}: loading debe ser eager`,
  );
  assert.equal(
    img.getAttribute("decoding"),
    "async",
    `${label}: decoding debe ser async`,
  );
  assert.equal(
    img.getAttribute("fetchpriority"),
    "high",
    `${label}: fetchpriority debe ser high`,
  );
}

describe("prioridad de imágenes (SEO-03 / SEO-02)", () => {
  it("home: tarjetas lazy sin fetchpriority y póster precargado con prioridad", () => {
    const root = readDistPage("index.html");
    const cards = cardImages(root);
    assert.equal(cards.length, 4, `home tiene ${cards.length} cards; se exigen 4`);
    for (const [index, img] of cards.entries()) {
      assertLazyCard(img, `home card #${index + 1}`);
    }

    const preloads = posterPreloads(root);
    assert.equal(
      preloads.length,
      1,
      `home debe precargar ${POSTER_HREF} exactamente una vez (hay ${preloads.length})`,
    );
    assert.equal(
      preloads[0]?.getAttribute("fetchpriority"),
      "high",
      "el preload del póster debe llevar fetchpriority=high",
    );
  });

  it("/trabajo: solo la primera tarjeta es eager/high; el resto lazy", () => {
    const root = readDistPage("trabajo.html");
    const cards = cardImages(root);
    assert.equal(
      cards.length,
      5,
      `/trabajo tiene ${cards.length} cards; se exigen 5`,
    );
    const [first, ...rest] = cards;
    assert.ok(first, "falta la primera card de /trabajo");
    assertPriorityCard(first, "/trabajo card #1");
    for (const [index, img] of rest.entries()) {
      assertLazyCard(img, `/trabajo card #${index + 2}`);
    }
  });

  it("ficha: imagen principal high; las 3 de Más trabajo lazy", () => {
    const root = readDistPage("trabajo/conexion-laboral.html");
    const main = root.querySelector("img.work-case__image");
    assert.ok(main, "falta img.work-case__image en la ficha");
    assert.equal(main.getAttribute("loading"), "eager");
    assert.equal(main.getAttribute("fetchpriority"), "high");
    assert.equal(main.getAttribute("width"), "1440");
    assert.equal(main.getAttribute("height"), "810");

    const related = cardImages(root);
    assert.equal(
      related.length,
      3,
      `Más trabajo tiene ${related.length} cards; se exigen 3`,
    );
    for (const [index, img] of related.entries()) {
      assertLazyCard(img, `Más trabajo card #${index + 1}`);
    }

    const highPriority = root
      .querySelectorAll("img")
      .filter((img) => img.getAttribute("fetchpriority") === "high");
    assert.equal(
      highPriority.length,
      1,
      `la ficha debe tener exactamente 1 img con fetchpriority=high (hay ${highPriority.length})`,
    );
  });

  it("preload del póster solo en la home: 1 en index, 0 en /trabajo y fichas", () => {
    assert.equal(
      posterPreloads(readDistPage("index.html")).length,
      1,
      `home debe tener exactamente 1 preload de ${POSTER_HREF}`,
    );
    assert.equal(
      posterPreloads(readDistPage("trabajo.html")).length,
      0,
      `/trabajo no debe precargar ${POSTER_HREF}`,
    );
    for (const page of CASE_DIST_PAGES) {
      assert.equal(
        posterPreloads(readDistPage(page)).length,
        0,
        `${page} no debe precargar ${POSTER_HREF}`,
      );
    }
  });
});
