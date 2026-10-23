import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { organizationLogoPath, pageMeta, siteJsonLd } from "./page-meta.ts";
import { socialLinks } from "./socials.ts";

describe("pageMeta", () => {
  it("fija title, description y H1 de las páginas publicadas", () => {
    assert.equal(
      pageMeta.home.title,
      "Neutro Solutions | Webs, sistemas y automatización con IA",
    );
    assert.equal(pageMeta.home.title.length, 57);
    assert.equal(
      pageMeta.home.description,
      "Webs, tiendas online, sistemas y automatización con IA para tu negocio. Ordenamos lo que hoy hacés a mano para que vendas más y trabajes menos. Escribinos.",
    );
    assert.equal(pageMeta.home.description.length, 155);
    assert.equal(
      pageMeta.home.heading,
      "Empezá a crear el sistema que te diferencia",
    );
    assert.equal(pageMeta.home.canonical, "https://neutro.solutions/");

    assert.equal(pageMeta.nosotros.title, "Nosotros | Neutro Solutions");
    assert.equal(pageMeta.nosotros.title.length, 27);
    assert.equal(
      pageMeta.nosotros.description,
      "Somos Neutro Solutions: diseñamos webs, tiendas y sistemas para tu negocio. Definimos con vos qué necesitás antes de construir y medimos para decidir mejor.",
    );
    assert.equal(pageMeta.nosotros.description.length, 156);
    assert.equal(pageMeta.nosotros.heading, "Quiénes somos y cómo trabajamos");
    assert.equal(
      pageMeta.nosotros.canonical,
      "https://neutro.solutions/nosotros",
    );
  });

  it("deja listos los textos legales con /alerta-estafa", () => {
    assert.equal(pageMeta.cookies.path, "/cookies");
    assert.equal(
      pageMeta.cookies.title,
      "Política de cookies | Neutro Solutions",
    );
    assert.equal(pageMeta.cookies.title.length, 38);
    assert.equal(
      pageMeta.cookies.description,
      "Qué guarda neutro.solutions en tu navegador y cómo medimos el uso del sitio. No usamos cookies ni banners: medimos sin cookies y descartamos tu dirección IP.",
    );
    assert.equal(pageMeta.cookies.description.length, 157);
    assert.equal(pageMeta.cookies.heading, "Política de cookies");
    assert.equal(
      pageMeta.cookies.canonical,
      "https://neutro.solutions/cookies",
    );

    assert.equal(pageMeta.privacidad.path, "/privacidad");
    assert.equal(
      pageMeta.privacidad.title,
      "Política de privacidad | Neutro Solutions",
    );
    assert.equal(pageMeta.privacidad.title.length, 41);
    assert.equal(
      pageMeta.privacidad.description,
      "Qué datos tuyos tratamos cuando nos escribís, para qué los usamos, cuánto tiempo los guardamos y cómo podés pedir acceso, corrección o que los borremos.",
    );
    assert.equal(pageMeta.privacidad.description.length, 152);
    assert.equal(pageMeta.privacidad.heading, "Política de privacidad");

    assert.equal(pageMeta.terminos.path, "/terminos");
    assert.equal(
      pageMeta.terminos.title,
      "Términos y condiciones | Neutro Solutions",
    );
    assert.equal(pageMeta.terminos.title.length, 41);
    assert.equal(
      pageMeta.terminos.description,
      "Las reglas para usar neutro.solutions: qué podés esperar del sitio, qué te pedimos a vos, tus derechos como consumidor y cómo hacer un reclamo si lo necesitás.",
    );
    assert.equal(pageMeta.terminos.description.length, 159);
    assert.equal(pageMeta.terminos.heading, "Términos y condiciones");

    assert.equal(pageMeta.alertaEstafa.path, "/alerta-estafa");
    assert.equal(
      pageMeta.alertaEstafa.canonical,
      "https://neutro.solutions/alerta-estafa",
    );
    assert.equal(
      pageMeta.alertaEstafa.title,
      "Alerta de estafa | Neutro Solutions",
    );
    assert.equal(pageMeta.alertaEstafa.title.length, 35);
    assert.equal(
      pageMeta.alertaEstafa.description,
      "¿Te escribieron en nombre de Neutro Solutions? Te contamos cuáles son nuestros únicos canales oficiales, cómo detectar una suplantación y dónde denunciarla.",
    );
    assert.equal(pageMeta.alertaEstafa.description.length, 156);
    assert.equal(
      pageMeta.alertaEstafa.heading,
      "Alerta de estafa: cómo reconocer nuestros canales oficiales",
    );
  });
});

describe("siteJsonLd", () => {
  it("publica un solo grafo Organization + WebSite", () => {
    assert.equal(siteJsonLd["@context"], "https://schema.org");
    assert.equal(Object.hasOwn(siteJsonLd, "@type"), false);
    const [organization, website] = siteJsonLd["@graph"];
    assert.equal(siteJsonLd["@graph"].length, 2);
    assert.equal(organization["@type"], "Organization");
    assert.equal(organization.name, "Neutro Solutions");
    assert.equal(organization["@id"], "https://neutro.solutions/#organization");
    assert.equal(organization.url, "https://neutro.solutions/");
    assert.equal(organization.email, "hola@neutro.solutions");
    assert.equal(organization.logo["@type"], "ImageObject");
    assert.equal(
      organization.logo.url,
      `https://neutro.solutions${organizationLogoPath}`,
    );
    assert.deepEqual(
      organization.sameAs,
      socialLinks.map((social) => social.href),
    );
    assert.equal(website["@type"], "WebSite");
    assert.equal(website["@id"], "https://neutro.solutions/#website");
    assert.equal(website.name, "Neutro Solutions");
    assert.equal(website.inLanguage, "es-AR");
    assert.equal(website.publisher["@id"], organization["@id"]);
  });

  it("el logo es el PNG de 512", () => {
    const png = readFileSync(
      new URL(`../../public${organizationLogoPath}`, import.meta.url),
    );
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
  });

  it("base emite ese grafo una sola vez y el H1 de la home no cambia", () => {
    const base = readFileSync(
      new URL("../layouts/base.astro", import.meta.url),
      "utf8",
    );
    assert.equal(base.match(/application\/ld\+json/g)?.length, 1);
    assert.equal(base.includes("JSON.stringify(siteJsonLd)"), true);
    assert.equal(base.includes("name: site.name"), false);
    assert.equal(base.includes('"@type": "Organization"'), false);

    const hero = readFileSync(
      new URL("../components/sections/Hero.astro", import.meta.url),
      "utf8",
    );
    assert.equal(hero.includes(pageMeta.home.heading), true);
  });
});
