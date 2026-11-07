import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const headerPath = fileURLToPath(new URL("./Header.astro", import.meta.url));
const drawerPath = fileURLToPath(
  new URL("./MobileDrawer.astro", import.meta.url),
);
const headerSource = readFileSync(headerPath, "utf8");
const drawerSource = readFileSync(drawerPath, "utf8");

function extractStyle(source: string): string {
  const match = source.match(/<style>([\s\S]*?)<\/style>/);
  const body = match?.[1];
  if (!body) throw new Error("missing <style>");
  return body;
}

function astroTemplate(source: string): string {
  const chunks = source.split(/^---\s*$/m);
  const template = chunks.length >= 3 ? chunks.slice(2).join("---") : source;
  return template
    .replace(/<script>[\s\S]*?<\/script>/g, "")
    .replace(/<style>[\s\S]*?<\/style>/g, "");
}

const headerCss = extractStyle(headerSource);
const drawerCss = extractStyle(drawerSource);
const headerTemplate = astroTemplate(headerSource);
const drawerTemplate = astroTemplate(drawerSource);

describe("site header black theme", () => {
  it("keeps the real header markup on a hard-coded black background by default", () => {
    assert.match(headerTemplate, /<header\b[^>]*\bclass="site-header dark"/);
    assert.match(headerCss, /\.site-header\s*\{[^}]*--neutro-bg:\s*#0a0a0a/);
    assert.match(headerCss, /\.site-header\s*\{[^}]*background:\s*#0a0a0a/);
    assert.doesNotMatch(
      headerCss,
      /\.site-header\s*\{[^}]*background:\s*var\(--neutro-bg\)/,
    );
  });

  it("forces a light logo on the black header", () => {
    assert.match(headerTemplate, /<Logo\b[^>]*\bforceDark\b/);
  });

  it("keeps nav and menu controls on light text tokens", () => {
    assert.match(headerCss, /\.site-header\s*\{[^}]*--neutro-text:\s*#f6f6f4/);
    assert.match(
      headerCss,
      /\.site-header__menu\s*\{[^}]*color:\s*var\(--neutro-text\)/,
    );
    assert.match(
      headerCss,
      /\.site-header__nav-link\s*\{[^}]*color:\s*var\(--neutro-text\)/,
    );
  });

  it("marca el ítem activo de nav con aria-current y subrayado naranja", () => {
    assert.match(headerTemplate, /aria-current=\{navIsCurrent\(item\.href\) \? "page" : undefined\}/);
    assert.match(
      headerCss,
      /\.site-header__nav-link\[aria-current="page"\]\s*\{[^}]*border-bottom:\s*1\.5px\s+solid\s+var\(--neutro-accent-orange\)/,
    );
  });

  it("keeps the mobile drawer black with a light logo", () => {
    assert.match(drawerTemplate, /<dialog\b[^>]*\bclass="mobile-drawer dark"/);
    assert.match(drawerCss, /\.mobile-drawer\s*\{[^}]*--neutro-bg:\s*#0a0a0a/);
    assert.match(drawerCss, /\.mobile-drawer\s*\{[^}]*background:\s*#0a0a0a/);
    assert.match(drawerTemplate, /<Logo\b[^>]*\bforceDark\b/);
  });
});
