import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

export function extractAuthorBody(raw) {
  const body = String(raw ?? "").replaceAll("\r\n", "\n");
  const begin = MARKER_BEGIN.exec(body);
  const end = MARKER_END.exec(body);
  let text = body;
  if (begin && end && begin.index < end.index) {
    text = body.slice(begin.index + begin[0].length, end.index);
  }
  text = text
    .replaceAll(/<!--\s*CURSOR_AGENT_PR_BODY_BEGIN\s*-->/g, "")
    .replaceAll(/<!--\s*CURSOR_AGENT_PR_BODY_END\s*-->/g, "");
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

export function checkPrBody(raw) {
  const sections = parseH2Sections(extractAuthorBody(raw));
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

function main() {
  const result = checkPrBody(process.env.PR_BODY);
  if (result.ok) {
    return;
  }
  for (const problem of result.problems) {
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
