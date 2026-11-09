import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTACTO_TURNSTILE_TEST_SITE_KEY,
  contactoChannels,
  contactoCountries,
  contactoFormCopy,
  contactoFormLimits,
  contactoHeroFlags,
  contactoHeroTiming,
  resolveContactoTurnstileSiteKey,
} from "./contacto.ts";
import {
  CONTACT_EMAIL_MAX,
  CONTACT_LINE_MAX,
  CONTACT_MESSAGE_MAX,
} from "../../worker/contacto/parse.ts";
import {
  buildTextDots,
  gridColumns,
  hasFlagPixels,
  nextDrawableFlagIndex,
  nextFlagIndex,
  pitchForWidth,
  shouldAnimate,
  type FlagPixel,
} from "../lib/contacto-hero.ts";

describe("contacto data", () => {
  it("expone la grilla de 8 casilleros con huecos decorativos", () => {
    assert.equal(contactoChannels.length, 8);
    assert.equal(contactoChannels[0]?.title, "Canales de comunicación");
    assert.equal(contactoChannels[1]?.decorative, true);
    assert.equal(contactoChannels[2]?.value, "+54 9 341 3 398-851");
    assert.equal(contactoChannels[2]?.href, "https://wa.me/5493413398851");
    assert.equal(
      contactoChannels[3]?.href,
      "https://instagram.com/neutro.solutions",
    );
    assert.equal(contactoChannels[5]?.value, "Próximamente");
    assert.equal(contactoChannels[6]?.decorative, true);
    assert.equal(contactoChannels[7]?.title, "Facebook");
  });

  it("mantiene el copy del formulario del Pen sin el link de forma de trabajar", () => {
    assert.equal(contactoFormCopy.title, "Construyamos algo juntos");
    assert.equal(
      contactoFormCopy.lines[0],
      "Unimos creatividad humana y tecnología elegida para tu negocio.",
    );
    assert.equal(
      contactoFormCopy.lines[1],
      "Cuidamos cada detalle para construir algo que marque la diferencia.",
    );
    assert.equal("workLinkHref" in contactoFormCopy, false);
    assert.equal("workLinkLabel" in contactoFormCopy, false);
    assert.equal(
      contactoFormCopy.success,
      "Tu consulta fue enviada para su entrega",
    );
    assert.equal(
      contactoFormCopy.error,
      "No pudimos confirmar el envío. Probá de nuevo o escribinos a hola@neutro.solutions",
    );
    assert.equal(contactoFormCopy.endpoint, "/api/contacto");
    assert.equal(contactoCountries[0], "Argentina");
    assert.equal(contactoCountries.includes("Otro"), true);
  });

  it("lista 20 banderas hispanohablantes para el hero LED", () => {
    assert.equal(contactoHeroFlags.length, 20);
    assert.equal(contactoHeroFlags[0]?.file, "argentina.svg");
    assert.equal(contactoHeroTiming.colMs, 30);
    assert.equal(contactoHeroTiming.holdMs, 1600);
  });

  it("alinea los límites del form con parse.ts", () => {
    assert.equal(contactoFormLimits.line, CONTACT_LINE_MAX);
    assert.equal(contactoFormLimits.email, CONTACT_EMAIL_MAX);
    assert.equal(contactoFormLimits.message, CONTACT_MESSAGE_MAX);
  });

  it("exige PUBLIC_TURNSTILE_SITE_KEY en producción y usa test key fuera", () => {
    assert.equal(
      resolveContactoTurnstileSiteKey({ PROD: false }),
      CONTACTO_TURNSTILE_TEST_SITE_KEY,
    );
    assert.equal(
      resolveContactoTurnstileSiteKey({
        PUBLIC_TURNSTILE_SITE_KEY: "  real-site-key  ",
        PROD: true,
      }),
      "real-site-key",
    );
    assert.throws(
      () => resolveContactoTurnstileSiteKey({ PROD: true }),
      /PUBLIC_TURNSTILE_SITE_KEY/,
    );
  });
});

describe("contacto hero helpers", () => {
  it("arma la grilla de puntos de Hola Mundo", () => {
    const { dots, textWidth } = buildTextDots();
    assert.ok(dots.length > 20);
    assert.ok(textWidth > 40);
    assert.equal(gridColumns(textWidth), textWidth + 3 + 14 + 2);
  });

  it("respeta reduced-motion y modo static", () => {
    assert.equal(shouldAnimate(true, false), false);
    assert.equal(shouldAnimate(false, true), false);
    assert.equal(shouldAnimate(false, false), true);
  });

  it("calcula pitch y cicla banderas", () => {
    assert.equal(pitchForWidth(1440, 76), Math.max(4, Math.floor(1200 / 76)));
    assert.equal(nextFlagIndex(19, 20), 0);
    assert.equal(nextFlagIndex(0, 20), 1);
  });

  it("trata buffers vacíos como banderas no dibujables", () => {
    assert.equal(hasFlagPixels(undefined), false);
    assert.equal(hasFlagPixels(null), false);
    assert.equal(hasFlagPixels([]), false);
    const pixel: FlagPixel = [1, 2, 3];
    assert.equal(hasFlagPixels([pixel]), true);
  });

  it("salta banderas fallidas al elegir el próximo índice dibujable", () => {
    const files = ["a.svg", "b.svg", "c.svg"] as const;
    const data: Record<string, FlagPixel[] | undefined> = {
      "a.svg": [],
      "b.svg": [[0, 0, 0]],
      "c.svg": [],
    };
    assert.equal(nextDrawableFlagIndex(0, files, data), 1);
    assert.equal(nextDrawableFlagIndex(1, files, data), 1);
    assert.equal(nextDrawableFlagIndex(2, files, data), 1);
    assert.equal(
      nextDrawableFlagIndex(0, files, { "a.svg": [], "b.svg": [], "c.svg": [] }),
      0,
    );
  });
});
