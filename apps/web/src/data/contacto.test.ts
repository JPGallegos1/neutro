import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contactoChannels,
  contactoCountries,
  contactoFormCopy,
} from "./contacto.ts";

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
});
