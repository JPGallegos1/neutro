import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const COLOR_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "outline",
  "outline-color",
  "box-shadow",
  "text-decoration-color",
  "fill",
  "stroke",
  "accent-color",
]);

const ALLOWED_KEYWORDS = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "none",
  "auto",
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "inset",
]);

const ALLOWED_NAMED = new Set([
  "black",
  "white",
  "gray",
  "grey",
  "silver",
  "gainsboro",
  "whitesmoke",
  "lightgray",
  "lightgrey",
  "darkgray",
  "darkgrey",
  "dimgray",
  "dimgrey",
]);

const ALLOWED_VARS = new Set([
  "--neutro-bg",
  "--neutro-surface",
  "--neutro-text",
  "--neutro-text-muted",
  "--neutro-border",
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--ease-out",
]);

const BANNED_VAR_RE =
  /--neutro-accent-orange(?:-strong)?|--neutro-on-orange|--neutro-accent-blue|--neutro-on-blue|--neutro-focus|--primary(?:-foreground)?|--accent(?:-foreground)?|--ring|--destructive\b/i;

const CTA_CLASS_RE =
  /(?:^|[^\w-])(?:[\w-]*(?:__)?(?:btn|cta|send|submit|load)(?:--|__|-)?[\w-]*|[\w-]*visit-link[\w-]*)(?:$|[^\w-])/i;

const CTA_TYPE_RE =
  /(?:^|[^\w-])button(?:$|[^\w-])|\[type\s*=\s*["']?(?:submit|button)["']?\]/i;

const MESSAGE = "Los CTAs deben ser monocromáticos";

const SOURCE_EXTS = new Set([".astro", ".css", ".tsx", ".jsx"]);

export function isCtaSelector(selector) {
  const parts = selector.split(",");
  return parts.some((part) => {
    const s = part.trim();
    if (!s) return false;
    if (CTA_TYPE_RE.test(s)) return true;
    if (CTA_CLASS_RE.test(s)) return true;
    if (/\ba\.contacto-channel__inner\b/i.test(s)) return true;
    return false;
  });
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractStyleBlocks(source, filePath) {
  const ext = extname(filePath);
  if (ext === ".css") return [source];
  const blocks = [];
  for (const match of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}

function walkRules(css, visit) {
  let i = 0;
  const text = css;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (i >= text.length) break;
    if (text.startsWith("@", i)) {
      const atStart = i;
      while (i < text.length && text[i] !== "{" && text[i] !== ";") i += 1;
      if (i >= text.length) break;
      if (text[i] === ";") {
        i += 1;
        continue;
      }
      const prelude = text.slice(atStart, i).trim();
      const body = readBraceBlock(text, i);
      if (!body) break;
      i = body.end;
      if (/^@(?:media|supports|layer|container)\b/i.test(prelude)) {
        walkRules(body.inner, visit);
      }
      continue;
    }
    const selStart = i;
    while (i < text.length && text[i] !== "{") i += 1;
    if (i >= text.length) break;
    const selector = text.slice(selStart, i).trim();
    const body = readBraceBlock(text, i);
    if (!body) break;
    i = body.end;
    visit(selector, body.inner);
  }
}

function readBraceBlock(text, openIndex) {
  if (text[openIndex] !== "{") return null;
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return { inner: text.slice(openIndex + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

function parseDeclarations(block) {
  const decls = [];
  for (const raw of block.split(";")) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const prop = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    decls.push({ prop, value });
  }
  return decls;
}

function expandColorCandidates(value) {
  const parts = [];
  const varMatches = value.matchAll(/var\(\s*(--[\w-]+)/gi);
  for (const match of varMatches) {
    parts.push({ kind: "var", raw: match[1] });
  }
  const hexMatches = value.matchAll(/#(?:[0-9a-f]{3,8})\b/gi);
  for (const match of hexMatches) {
    parts.push({ kind: "hex", raw: match[0] });
  }
  const rgbMatches = value.matchAll(
    /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/gi,
  );
  for (const match of rgbMatches) {
    parts.push({
      kind: "rgb",
      raw: match[0],
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
    });
  }
  const hslMatches = value.matchAll(
    /hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)/gi,
  );
  for (const match of hslMatches) {
    parts.push({
      kind: "hsl",
      raw: match[0],
      h: Number(match[1]),
      s: Number(match[2]),
      l: Number(match[3]),
    });
  }
  const oklchMatches = value.matchAll(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/gi,
  );
  for (const match of oklchMatches) {
    parts.push({
      kind: "oklch",
      raw: match[0],
      c: Number(match[2]),
    });
  }
  const withoutFns = value
    .replace(/var\(\s*--[\w-]+(?:\s*,[^)]+)?\)/gi, " ")
    .replace(/#(?:[0-9a-f]{3,8})\b/gi, " ")
    .replace(/rgba?\([^)]*\)/gi, " ")
    .replace(/hsla?\([^)]*\)/gi, " ")
    .replace(/oklch\([^)]*\)/gi, " ")
    .replace(/color-mix\([^)]*\)/gi, " ")
    .replace(/calc\([^)]*\)/gi, " ");
  const words = withoutFns.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const word of words) {
    if (
      ALLOWED_KEYWORDS.has(word) ||
      word === "px" ||
      word === "em" ||
      word === "rem" ||
      word === "ms" ||
      word === "s" ||
      word === "deg"
    ) {
      continue;
    }
    if (ALLOWED_NAMED.has(word)) continue;
    parts.push({ kind: "named", raw: word });
  }
  return parts;
}

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (h.length === 8) {
    h = h.slice(0, 6);
  }
  if (h.length !== 6) return null;
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

function isGrayscaleRgb(r, g, b, tol = 14) {
  return (
    Math.abs(r - g) <= tol && Math.abs(g - b) <= tol && Math.abs(r - b) <= tol
  );
}

export function isMonochromeColorValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (BANNED_VAR_RE.test(trimmed)) return false;
  const candidates = expandColorCandidates(trimmed);
  if (candidates.length === 0) {
    return true;
  }
  for (const part of candidates) {
    if (part.kind === "var") {
      if (BANNED_VAR_RE.test(part.raw)) return false;
      if (!ALLOWED_VARS.has(part.raw)) return false;
      continue;
    }
    if (part.kind === "hex") {
      const rgb = hexToRgb(part.raw);
      if (!rgb || !isGrayscaleRgb(rgb.r, rgb.g, rgb.b)) return false;
      continue;
    }
    if (part.kind === "rgb") {
      if (!isGrayscaleRgb(part.r, part.g, part.b)) return false;
      continue;
    }
    if (part.kind === "hsl") {
      if (part.s > 4) return false;
      continue;
    }
    if (part.kind === "oklch") {
      if (part.c > 0.02) return false;
      continue;
    }
    if (part.kind === "named") {
      if (!ALLOWED_NAMED.has(part.raw) && !ALLOWED_KEYWORDS.has(part.raw)) {
        return false;
      }
    }
  }
  return true;
}

export function lintCss(css, filePath = "fixture.css") {
  const findings = [];
  const cleaned = stripComments(css);
  walkRules(cleaned, (selector, body) => {
    if (!isCtaSelector(selector)) return;
    for (const decl of parseDeclarations(body)) {
      if (!COLOR_PROPS.has(decl.prop)) continue;
      if (isMonochromeColorValue(decl.value)) continue;
      findings.push({
        file: filePath,
        selector: selector.replace(/\s+/g, " ").trim(),
        prop: decl.prop,
        value: decl.value,
        message: MESSAGE,
      });
    }
  });
  return findings;
}

export function lintSource(source, filePath) {
  const findings = [];
  for (const block of extractStyleBlocks(source, filePath)) {
    findings.push(...lintCss(block, filePath));
  }
  if (/\.(?:tsx|jsx|astro)$/.test(filePath)) {
    const classHits =
      source.match(
        /(?:class(?:Name)?\s*=\s*["'`][^"'`]*\b(?:bg|text|border|ring|outline)-(?:primary|accent|destructive|ring)\b[^"'`]*)/gi,
      ) ?? [];
    for (const hit of classHits) {
      if (
        !/\bbutton\b|type=["']submit["']|__btn|__cta|__send|btn-/i.test(source)
      ) {
        continue;
      }
      findings.push({
        file: filePath,
        selector: hit.slice(0, 120),
        prop: "class",
        value: hit.slice(0, 120),
        message: MESSAGE,
      });
    }
  }
  return findings;
}

function listFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) {
      continue;
    }
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) listFiles(path, out);
    else if (SOURCE_EXTS.has(extname(name))) out.push(path);
  }
  return out;
}

export function lintPaths(roots) {
  const findings = [];
  for (const root of roots) {
    for (const file of listFiles(root)) {
      const source = readFileSync(file, "utf8");
      const rel = relative(process.cwd(), file);
      findings.push(...lintSource(source, rel));
    }
  }
  return findings;
}

export function formatFindings(findings) {
  return findings
    .map(
      (f) => `${f.file}: ${f.message} (${f.selector} → ${f.prop}: ${f.value})`,
    )
    .join("\n");
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, "../..");
  const roots = [join(repoRoot, "apps/web/src")];
  const findings = lintPaths(roots);
  if (findings.length === 0) {
    process.stdout.write("cta-monochrome: ok\n");
    process.exit(0);
  }
  process.stderr.write(`${formatFindings(findings)}\n`);
  process.stderr.write(
    `cta-monochrome: ${findings.length} violación(es). ${MESSAGE}.\n`,
  );
  process.exit(1);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) main();
