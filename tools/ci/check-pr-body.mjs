import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { checkChangeEvidence } from "./pr-evidence.mjs";

const REQUIRED_HEADINGS = [
  "Problema",
  "Restricciones y verdades",
  "Razonamiento",
  "Solución",
  "Trade-offs",
  "Verificación",
];

const MARKER_BEGIN = /<!--\s*CURSOR_AGENT_PR_BODY_BEGIN\s*-->/;
const MARKER_END = /<!--\s*CURSOR_AGENT_PR_BODY_END\s*-->/;

function isCursorFooterLine(line) {
  const trimmed = line.trim();
  if (trimmed === "") {
    return true;
  }
  return (
    trimmed.includes("cursor_ref=pr_footer") ||
    trimmed.includes("cursor.com/assets/images/open-in-")
  );
}

function stripCursorFooter(text) {
  const lines = text.split("\n");
  let end = lines.length;
  while (end > 0 && isCursorFooterLine(lines[end - 1])) {
    end -= 1;
  }
  return lines.slice(0, end).join("\n");
}

function fenceSpans(text) {
  const spans = [];
  let offset = 0;
  let openAt = -1;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineEnd = offset + line.length + (i < lines.length - 1 ? 1 : 0);
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
      if (openAt === -1) {
        openAt = offset;
      } else {
        spans.push([openAt, lineEnd]);
        openAt = -1;
      }
    }
    offset = lineEnd;
  }
  if (openAt !== -1) {
    spans.push([openAt, text.length]);
  }
  return spans;
}

function spanCovering(spans, index) {
  for (const span of spans) {
    if (index < span[0]) return null;
    if (index < span[1]) return span;
  }
  return null;
}

function nextSpanFrom(spans, index) {
  for (const span of spans) {
    if (span[0] >= index) return span;
  }
  return null;
}

function findBacktickRun(text, from, length, fences) {
  let index = from;
  while (index < text.length) {
    if (spanCovering(fences, index)) return -1;
    if (text[index] !== "`") {
      index += 1;
      continue;
    }
    const ahead = nextSpanFrom(fences, index);
    const limit = ahead ? ahead[0] : text.length;
    let run = 0;
    while (index + run < limit && text[index + run] === "`") run += 1;
    if (run === length) return index;
    index += run;
  }
  return -1;
}

function codeSpans(text) {
  const fences = fenceSpans(text);
  const spans = fences.slice();
  let index = 0;
  while (index < text.length) {
    const fence = spanCovering(fences, index);
    if (fence) {
      index = fence[1];
      continue;
    }
    if (text[index] !== "`") {
      index += 1;
      continue;
    }
    let length = 0;
    while (
      index + length < text.length &&
      text[index + length] === "`" &&
      !spanCovering(fences, index + length)
    ) {
      length += 1;
    }
    if (length === 0) {
      index += 1;
      continue;
    }
    const closer = findBacktickRun(text, index + length, length, fences);
    if (closer === -1) {
      index += length;
      continue;
    }
    spans.push([index, closer + length]);
    index = closer + length;
  }
  spans.sort((a, b) => a[0] - b[0]);
  return spans;
}

function stripHtmlComments(text) {
  const spans = codeSpans(text);
  const parts = [];
  let index = 0;
  while (index < text.length) {
    const span = spanCovering(spans, index);
    if (span) {
      parts.push(text.slice(index, span[1]));
      index = span[1];
      continue;
    }
    const upcoming = nextSpanFrom(spans, index);
    const limit = upcoming ? upcoming[0] : text.length;
    const start = text.indexOf("<!--", index);
    if (start === -1 || start >= limit) {
      parts.push(text.slice(index, start === -1 ? text.length : limit));
      if (start === -1) break;
      index = limit;
      continue;
    }
    parts.push(text.slice(index, start));
    const after = start + 4;
    if (text.startsWith(">", after)) {
      index = after + 1;
      continue;
    }
    if (text.startsWith("->", after)) {
      index = after + 2;
      continue;
    }
    const end = text.indexOf("-->", after);
    if (end === -1) break;
    index = end + 3;
  }
  return parts.join("");
}

export function extractAuthorBody(raw) {
  let body = String(raw ?? "");
  while (body.charCodeAt(0) === 0xfeff) {
    body = body.slice(1);
  }
  body = body.replaceAll("\r\n", "\n");
  const begin = MARKER_BEGIN.exec(body);
  const end = MARKER_END.exec(body);
  let text = body;
  if (begin && end && begin.index < end.index) {
    text = body.slice(begin.index + begin[0].length, end.index);
  }
  text = stripHtmlComments(text);
  return stripCursorFooter(text);
}

function parseH2Sections(text) {
  const lines = text.split("\n");
  const sections = [];
  let inFence = false;
  let current = null;
  for (const line of lines) {
    const fence = /^ {0,3}(`{3,}|~{3,})/.test(line);
    if (fence) {
      inFence = !inFence;
      if (current) {
        current.lines.push(line);
      }
      continue;
    }
    if (!inFence) {
      const match = /^##[ \t]+(.+)$/.exec(line);
      if (match) {
        if (current) {
          sections.push({
            title: current.title,
            content: current.lines.join("\n").trim(),
          });
        }
        current = { title: match[1].trim(), lines: [] };
        continue;
      }
    }
    if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    sections.push({
      title: current.title,
      content: current.lines.join("\n").trim(),
    });
  }
  return sections;
}

export function authorSections(raw) {
  return parseH2Sections(extractAuthorBody(raw));
}

export function withoutCode(text) {
  const spans = codeSpans(text);
  const parts = [];
  let index = 0;
  for (const span of spans) {
    if (span[0] < index) {
      continue;
    }
    parts.push(text.slice(index, span[0]));
    parts.push("\n");
    index = span[1];
  }
  parts.push(text.slice(index));
  return parts.join("");
}

export function checkPrBody(raw) {
  const sections = authorSections(raw);
  const problems = [];
  let cursor = 0;
  for (const title of REQUIRED_HEADINGS) {
    let found = -1;
    for (let index = cursor; index < sections.length; index += 1) {
      if (sections[index].title === title) {
        found = index;
        break;
      }
    }
    if (found === -1) {
      const earlier = sections.some((section) => section.title === title);
      problems.push(
        earlier
          ? `La sección «${title}» está fuera de orden.`
          : `Falta la sección «${title}».`,
      );
      continue;
    }
    if (sections[found].content === "") {
      problems.push(`La sección «${title}» no tiene contenido.`);
    }
    cursor = found + 1;
  }
  return { ok: problems.length === 0, problems };
}

export function readPullRequestBody(env = process.env) {
  if (env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
      const body = event?.pull_request?.body;
      return { body: typeof body === "string" ? body : "" };
    } catch {
      return { error: true };
    }
  }
  return { body: typeof env.PR_BODY === "string" ? env.PR_BODY : "" };
}

const SHA = /^[0-9a-f]{7,64}$/i;

function readChangedPaths(env) {
  const base = typeof env.BASE_SHA === "string" ? env.BASE_SHA : "";
  const head = typeof env.HEAD_SHA === "string" ? env.HEAD_SHA : "";
  if (base === "" && head === "") {
    return { ok: true, paths: [] };
  }
  if (base === "" || head === "") {
    return { ok: false, error: "BASE_SHA y HEAD_SHA van juntos." };
  }
  if (!SHA.test(base) || !SHA.test(head)) {
    return {
      ok: false,
      error: "BASE_SHA y HEAD_SHA tienen que ser SHAs en hexadecimal.",
    };
  }
  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", `${base}...${head}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return {
      ok: true,
      paths: output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
  } catch {
    return {
      ok: false,
      error: "No se pudo leer el diff entre BASE_SHA y HEAD_SHA.",
    };
  }
}

function main() {
  const read = readPullRequestBody();
  if (read.error) {
    console.error("No se pudo leer el cuerpo desde el archivo del evento.");
    process.exit(1);
  }
  const diff = readChangedPaths(process.env);
  if (!diff.ok) {
    console.error(diff.error);
    process.exit(1);
  }
  const problems = [
    ...checkPrBody(read.body).problems,
    ...checkChangeEvidence(read.body, diff.paths).problems,
  ];
  if (problems.length === 0) {
    return;
  }
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}

function invokedAsScript() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (invokedAsScript()) {
  main();
}
