import { readFileSync, realpathSync } from "node:fs";
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

function stripHtmlComments(text) {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf("<!--", index);
    if (start === -1) {
      out += text.slice(index);
      break;
    }
    out += text.slice(index, start);
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
    if (end === -1) {
      break;
    }
    index = end + 3;
  }
  return out;
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

function main() {
  const read = readPullRequestBody();
  if (read.error) {
    console.error("No se pudo leer el cuerpo desde el archivo del evento.");
    process.exit(1);
  }
  const result = checkPrBody(read.body);
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
