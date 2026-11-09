import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const channelsPath = fileURLToPath(
  new URL("./ContactoChannels.astro", import.meta.url),
);
const formPath = fileURLToPath(
  new URL("./ContactoForm.astro", import.meta.url),
);
const heroPath = fileURLToPath(
  new URL("./ContactoHero.astro", import.meta.url),
);
const pagePath = fileURLToPath(
  new URL("../../pages/contacto.astro", import.meta.url),
);

function extractStyle(source: string): string {
  const match = source.match(/<style>([\s\S]*?)<\/style>/);
  const body = match?.[1];
  if (!body) throw new Error("missing <style>");
  return body;
}

function extractScript(source: string): string {
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  const body = match?.[1];
  if (!body) throw new Error("missing <script>");
  return body;
}

function astroTemplate(source: string): string {
  const chunks = source.split(/^---\s*$/m);
  const template = chunks.length >= 3 ? chunks.slice(2).join("---") : source;
  return template
    .replace(/<script>[\s\S]*?<\/script>/g, "")
    .replace(/<style>[\s\S]*?<\/style>/g, "");
}

const channelsSource = readFileSync(channelsPath, "utf8");
const formSource = readFileSync(formPath, "utf8");
const heroSource = readFileSync(heroPath, "utf8");
const pageSource = readFileSync(pagePath, "utf8");

describe("ContactoChannels", () => {
  it("oculta celdas vacías en mobile y las muestra desde desktop", () => {
    const css = extractStyle(channelsSource);
    assert.match(css, /\.contacto-channel--blank\s*\{[^}]*display:\s*none/);
    assert.match(
      css,
      /@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*\.contacto-channel--blank\s*\{[^}]*display:\s*block/,
    );
  });

  it("aplica negro de canales sólo en desktop", () => {
    const css = extractStyle(channelsSource);
    assert.match(
      css,
      /@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*\.contacto-channel--dark\s*\{[^}]*background:\s*#0a0a0a/,
    );
  });

  it("limita el hover oscuro de --dark a desktop ≥1024", () => {
    const css = extractStyle(channelsSource);
    assert.match(
      css,
      /@media\s*\(hover:\s*hover\)\s*and\s*\(prefers-reduced-motion:\s*no-preference\)\s*and\s*\(min-width:\s*1024px\)\s*\{[\s\S]*\.contacto-channel--dark\s+a\.contacto-channel__inner:hover\s*\{[^}]*background:\s*#1f1f1e/,
    );
    assert.doesNotMatch(
      css,
      /@media\s*\(hover:\s*hover\)\s*and\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[^}]*\.contacto-channel--dark\s+a\.contacto-channel__inner:hover/,
    );
  });
});

describe("ContactoForm", () => {
  it("deshabilita Enviar hasta el consentimiento y postea al API", () => {
    const template = astroTemplate(formSource);
    const script = extractScript(formSource);
    assert.match(template, /data-contacto-submit/);
    assert.match(template, /\bdisabled\b/);
    assert.match(template, /data-contacto-success/);
    assert.match(template, /data-contacto-error/);
    assert.match(template, /cf-turnstile/);
    assert.match(
      script,
      /submit\.disabled\s*=\s*busy\s*\|\|\s*!consent\.checked/,
    );
    assert.match(script, /event\.preventDefault\(\)/);
    assert.match(script, /fetch\(contactoFormCopy\.endpoint/);
    assert.match(script, /turnstileApi\(\)\?\.reset/);
  });

  it("deja espacio entre oraciones del intro en markup", () => {
    const template = astroTemplate(formSource);
    assert.match(
      template,
      /contactoFormCopy\.lines\.length\s*-\s*1\s*\?\s*" "/,
    );
    assert.doesNotMatch(template, /nuestra-forma-de-trabajar|workLink/);
  });

  it("marca requeridos del Pen y deja Mensaje opcional", () => {
    const template = astroTemplate(formSource);
    assert.match(template, /name="nombre"[\s\S]*?\brequired\b/);
    assert.match(template, /name="apellido"[\s\S]*?\brequired\b/);
    assert.match(template, /name="empresa"[\s\S]*?\brequired\b/);
    assert.match(template, /name="email"[\s\S]*?\brequired\b/);
    assert.match(template, /name="ciudad"[\s\S]*?\brequired\b/);
    assert.match(template, /name="pais"[\s\S]*?\brequired\b/);
    assert.match(template, /maxlength=\{contactoFormLimits\.line\}/);
    assert.match(
      template,
      /<textarea\b[^>]*\bname="mensaje"[^>]*>|<textarea\b[^>]*\brows="3"[^>]*>/,
    );
    assert.doesNotMatch(template, /<textarea\b[^>]*\brequired\b/);
    assert.match(template, /\(opcional\)/);
  });
});

describe("ContactoHero", () => {
  it("usa hero C y respeta prefers-reduced-motion vía helper", () => {
    const css = extractStyle(heroSource);
    const script = extractScript(heroSource);
    assert.match(css, /repeating-linear-gradient/);
    assert.match(script, /shouldAnimate/);
    assert.match(script, /prefers-reduced-motion:\s*reduce/);
    assert.match(script, /hasFlagPixels/);
    assert.match(script, /nextDrawableFlagIndex/);
  });
});

describe("página /contacto", () => {
  it("compone hero, canales, formulario, header y footer", () => {
    assert.match(pageSource, /ContactoHero/);
    assert.match(pageSource, /ContactoChannels/);
    assert.match(pageSource, /ContactoForm/);
    assert.match(pageSource, /<Header\s*\/>/);
    assert.match(pageSource, /<Footer\s*\/>/);
    assert.match(pageSource, /pageMeta\.contacto/);
  });
});
