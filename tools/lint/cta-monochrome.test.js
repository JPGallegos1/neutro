import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatFindings,
  isCtaSelector,
  isMonochromeColorValue,
  lintCss,
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
});
