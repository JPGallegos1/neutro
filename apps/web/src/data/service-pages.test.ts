import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { workProjects } from "./work.ts";
import {
  SHOW_WEB_SITIO_PRESUPUESTO_LINE,
  SHOW_WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE,
  WEB_SITIO_PRESUPUESTO_LINE,
  WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE,
  servicePageCases,
  servicePageJsonLd,
  servicePages,
} from "./service-pages.ts";

describe("service-pages", () => {
  it("expone title, meta, H1 y bajada exactos de Jake para /web y /automatizacion-ia", () => {
    assert.equal(
      servicePages.web.title,
      "Diseño web en Rosario para negocios | Neutro Solutions",
    );
    assert.equal(
      servicePages.web.description,
      "Hacemos webs claras para negocios de Rosario y todo el país: sitio, turnos online, rediseño y medición. Ves el diseño antes de que lo construyamos.",
    );
    assert.equal(
      servicePages.web.heading,
      "Diseño web en Rosario para que te elijan antes de preguntar",
    );
    assert.equal(
      servicePages.automatizacionIa.title,
      "Automatización con IA y bots de WhatsApp | Neutro Solutions",
    );
    assert.equal(
      servicePages.automatizacionIa.heading,
      "Automatización con IA para que lo que hacés a mano funcione solo",
    );
  });

  it("mantiene las frases Confirmar detrás de flags en false", () => {
    assert.equal(SHOW_WEB_SITIO_PRESUPUESTO_LINE, false);
    assert.equal(SHOW_WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE, false);
    assert.equal(
      WEB_SITIO_PRESUPUESTO_LINE,
      "El presupuesto depende de lo que tiene que hacer tu web; escribinos y te lo armamos.",
    );
    assert.equal(
      WEB_TURNOS_SUMAR_A_WEB_ACTUAL_LINE,
      "También se pueden sumar a la web que ya tenés.",
    );
  });

  it("resuelve los 4 casos de /web con paths relativos /trabajo/<slug>", () => {
    const cases = servicePageCases(servicePages.web);
    assert.equal(cases.length, 4);
    assert.deepEqual(
      cases.map((item) => item.slug),
      [
        "afectiva",
        "capa-automotores",
        "suplementacion-ciencia",
        "conexion-laboral",
      ],
    );
    assert.equal(
      cases.some((item) => item.slug === "luxurycars"),
      false,
    );
    for (const project of cases) {
      assert.match(project.href, /^\/trabajo\/[a-z0-9-]+$/);
      assert.ok(workProjects.some((item) => item.slug === project.slug));
    }
    assert.equal(servicePages.automatizacionIa.caseSlugs.length, 0);
    assert.equal(servicePageCases(servicePages.automatizacionIa).length, 0);
  });

  it("enlaza solo rutas de servicio existentes entre sí", () => {
    assert.deepEqual(servicePages.web.related, [
      { href: "/automatizacion-ia", label: "Automatización con IA" },
    ]);
    assert.deepEqual(servicePages.automatizacionIa.related, [
      { href: "/web", label: "Web" },
    ]);
  });

  it("arma JSON-LD con Service y BreadcrumbList, sin FAQPage", () => {
    const json = servicePageJsonLd(servicePages.web);
    const types = json["@graph"].map((node) => node["@type"]);
    assert.deepEqual(types, ["Service", "BreadcrumbList"]);
    assert.equal("FAQPage" in json, false);
    const service = json["@graph"][0];
    assert.ok(service && "areaServed" in service);
    const areas = service.areaServed as { name: string }[];
    assert.ok(areas.some((area) => area.name === "Argentina"));
    assert.ok(areas.some((area) => area.name === "Rosario"));
  });
});
