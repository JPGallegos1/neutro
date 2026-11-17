import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatFindings,
  isCtaSelector,
  isMonochromeColorValue,
  isMonochromeUtilityClass,
  lintCss,
  lintSource,
  normalizeUtilityClass,
} from "./cta-monochrome.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures/cta-monochrome");

describe("isCtaSelector", () => {
  it("detecta button, submit y clases CTA", () => {
    assert.equal(isCtaSelector("button"), true);
    assert.equal(isCtaSelector(".foo button.bar"), true);
    assert.equal(isCtaSelector('input[type="submit"]'), true);
    assert.equal(isCtaSelector(".contacto-form__send:hover"), true);
    assert.equal(isCtaSelector(".not-found__btn--primary"), true);
    assert.equal(isCtaSelector(".work-index__load"), true);
    assert.equal(isCtaSelector(".work-case__visit-link"), true);
    assert.equal(
      isCtaSelector("a.contacto-channel__inner:focus-visible"),
      true,
    );
    assert.equal(isCtaSelector(".contacto-channel__inner"), true);
  });

  it("ignora selectores que no son CTA", () => {
    assert.equal(isCtaSelector(".contacto-field input:focus-visible"), false);
    assert.equal(isCtaSelector(".contacto-consent input"), false);
    assert.equal(isCtaSelector(".site-header__nav-link"), false);
    assert.equal(isCtaSelector(".hero__lead"), false);
  });
});

describe("isMonochromeColorValue", () => {
  it("acepta grises y tokens monocromáticos", () => {
    assert.equal(isMonochromeColorValue("#0a0a0a"), true);
    assert.equal(isMonochromeColorValue("#ffffff"), true);
    assert.equal(isMonochromeColorValue("#e7e7e4"), true);
    assert.equal(isMonochromeColorValue("var(--neutro-text)"), true);
    assert.equal(isMonochromeColorValue("2px solid #0a0a0a"), true);
    assert.equal(isMonochromeColorValue("transparent"), true);
  });

  it("rechaza naranja, azul y tokens de acento", () => {
    assert.equal(isMonochromeColorValue("#c2410c"), false);
    assert.equal(isMonochromeColorValue("#9a3412"), false);
    assert.equal(isMonochromeColorValue("#5c78ff"), false);
    assert.equal(isMonochromeColorValue("var(--neutro-accent-orange)"), false);
    assert.equal(isMonochromeColorValue("var(--neutro-focus)"), false);
    assert.equal(isMonochromeColorValue("var(--primary)"), false);
  });
});

describe("normalizeUtilityClass / isMonochromeUtilityClass", () => {
  it("normaliza variantes y opacidad", () => {
    assert.equal(normalizeUtilityClass("hover:bg-orange-500"), "bg-orange-500");
    assert.equal(
      normalizeUtilityClass("md:focus-visible:text-primary/50"),
      "text-primary",
    );
    assert.equal(
      normalizeUtilityClass("disabled:bg-neutro-accent-orange/[50]"),
      "bg-neutro-accent-orange",
    );
  });

  it("acepta utilidades monocromáticas", () => {
    assert.equal(isMonochromeUtilityClass("bg-black"), true);
    assert.equal(isMonochromeUtilityClass("hover:text-white"), true);
    assert.equal(isMonochromeUtilityClass("bg-zinc-900"), true);
    assert.equal(isMonochromeUtilityClass("text-neutro-text"), true);
    assert.equal(isMonochromeUtilityClass("bg-[#0a0a0a]"), true);
    assert.equal(isMonochromeUtilityClass("border-muted"), true);
  });

  it("rechaza neutro cromático, semantic y Tailwind numerado", () => {
    assert.equal(isMonochromeUtilityClass("bg-neutro-accent-orange"), false);
    assert.equal(isMonochromeUtilityClass("text-neutro-on-blue"), false);
    assert.equal(isMonochromeUtilityClass("ring-neutro-focus"), false);
    assert.equal(isMonochromeUtilityClass("bg-orange-500"), false);
    assert.equal(isMonochromeUtilityClass("text-blue-600"), false);
    assert.equal(isMonochromeUtilityClass("hover:bg-primary/50"), false);
    assert.equal(isMonochromeUtilityClass("bg-[#ff6600]"), false);
  });
});

describe("lintCss fixtures", () => {
  it("pasa el fixture monocromo", () => {
    const css = readFileSync(join(fixtures, "pass.css"), "utf8");
    const findings = lintCss(css, "pass.css");
    assert.deepEqual(findings, []);
  });

  it("falla el fixture naranja/azul con mensaje en español", () => {
    const css = readFileSync(join(fixtures, "fail.css"), "utf8");
    const findings = lintCss(css, "fail.css");
    assert.ok(findings.length >= 4, `esperaba ≥4, got ${findings.length}`);
    for (const finding of findings) {
      assert.equal(finding.message, "Los CTAs deben ser monocromáticos");
    }
    const text = formatFindings(findings);
    assert.match(text, /Los CTAs deben ser monocromáticos/);
    assert.match(text, /#c2410c|neutro-accent-orange|neutro-accent-blue/);
  });

  it("detecta .contacto-channel__inner sin prefijo a", () => {
    const findings = lintCss(
      `.contacto-channel__inner { color: #c2410c; }`,
      "channels.css",
    );
    assert.equal(findings.length, 1);
  });
});

describe("lintSource por elemento", () => {
  it("no falla por text-primary en un h1 del mismo archivo que un button", () => {
    const source = `
      <h1 class="text-primary">Título</h1>
      <button class="bg-black text-white">Enviar</button>
    `;
    assert.deepEqual(lintSource(source, "page.astro"), []);
  });

  it("falla por clases cromáticas en el button, no en el h1", () => {
    const source = `
      <h1 class="text-primary">Título</h1>
      <button class="bg-primary text-white">Enviar</button>
    `;
    const findings = lintSource(source, "page.astro");
    assert.equal(findings.length, 1);
    assert.match(findings[0].value, /bg-primary/);
    assert.match(findings[0].selector, /button/i);
  });

  it("normaliza variantes y opacidad antes de evaluar", () => {
    const source = `<button class="md:hover:bg-orange-500/50 focus-visible:text-blue-600">Go</button>`;
    const findings = lintSource(source, "cta.astro");
    assert.ok(findings.length >= 2);
    const values = findings.map((f) => f.value).join(" ");
    assert.match(values, /bg-orange-500/);
    assert.match(values, /text-blue-600/);
  });

  it("rechaza neutro-accent / neutro-on / neutro-focus en CTAs", () => {
    const source = `
      <button class="bg-neutro-accent-orange text-neutro-on-orange ring-neutro-focus">Enviar</button>
    `;
    const findings = lintSource(source, "cta.astro");
    assert.ok(findings.length >= 3);
    const values = findings.map((f) => f.value).join(" ");
    assert.match(values, /neutro-accent-orange/);
    assert.match(values, /neutro-on-orange/);
    assert.match(values, /neutro-focus/);
  });

  it("rechaza colores Tailwind numerados en CTAs", () => {
    const source = `<a class="not-found__btn bg-orange-500 text-blue-600" href="/">Home</a>`;
    const findings = lintSource(source, "cta.astro");
    assert.ok(findings.length >= 2);
  });

  it("pasa valores arbitrarios [...] por isMonochromeColorValue", () => {
    const bad = lintSource(
      `<button class="bg-[#ff6600]">Bad</button>`,
      "cta.astro",
    );
    const badVar = lintSource(
      `<button class="bg-[var(--neutro-accent-orange)]">Bad</button>`,
      "cta.astro",
    );
    const good = lintSource(
      `<button class="bg-[#111111] text-[#f5f5f5]">Ok</button>`,
      "cta.astro",
    );
    assert.equal(bad.length, 1);
    assert.equal(badVar.length, 1);
    assert.deepEqual(good, []);
  });

  it("pasa atributos style por isMonochromeColorValue", () => {
    const bad = lintSource(
      `<button style="background: #c2410c; color: white">Bad</button>`,
      "cta.astro",
    );
    const good = lintSource(
      `<button style="background: #0a0a0a; color: #fff">Ok</button>`,
      "cta.astro",
    );
    const ignored = lintSource(
      `<h1 style="color: #c2410c">No CTA</h1><button class="bg-black">Ok</button>`,
      "cta.astro",
    );
    assert.equal(bad.length, 1);
    assert.match(bad[0].prop, /style/);
    assert.deepEqual(good, []);
    assert.deepEqual(ignored, []);
  });

  it("trata input submit como CTA y links sin aspecto de botón no", () => {
    const submit = lintSource(
      `<input type="submit" class="bg-primary" value="Enviar" />`,
      "form.astro",
    );
    const plainLink = lintSource(
      `<a class="text-primary" href="/">Nav</a>`,
      "nav.astro",
    );
    assert.equal(submit.length, 1);
    assert.deepEqual(plainLink, []);
  });
});
