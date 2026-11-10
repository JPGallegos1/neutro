import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
const LOCKS = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);
const LIMIT = 1000;
const LABEL = "excepcion-tamano-pr";
const ACTOR = "JPGallegos1";
const SHA = /^[0-9a-fA-F]{7,64}$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^##[ \t]+(.*?)[ \t]*$/;
const MOTIVO_RE = /^ {0,3}[-*] +Motivo:[ ]*(.*)$/;
const VENCE_RE = /^ {0,3}[-*] +Vence:[ ]*(.*)$/;
const NEED_SHA = "Hacen falta BASE_SHA y HEAD_SHA.";
const BAD_SHA = "BASE_SHA y HEAD_SHA no son SHAs hexadecimales.";
const GIT_FAIL = "git diff --numstat falló.";
const NUMSTAT_FAIL = "La línea de numstat no se puede contar.";
const EVENT_FAIL = "No se pudo leer el evento del pull request.";
const REPO_FAIL = "Hace falta GITHUB_REPOSITORY (owner/repo).";
const TIMELINE_FAIL = "No se pudo leer el timeline del pull request.";
const SECTION_MISSING = "Falta la sección «Excepción de tamaño».";
const MOTIVO_MISSING = "Falta Motivo.";
const MOTIVO_EMPTY = "Motivo está vacío.";
const VENCE_MISSING = "Falta Vence.";
const VENCE_BAD = "Vence tiene que ser una fecha real YYYY-MM-DD.";
const CLAIM_FAIL = "Faltan Motivo y Vence vigentes en el cuerpo.";
const NO_EVENT = "No hay un labeled ni un unlabeled de ese label.";
const UNLABELED = "El último evento de excepcion-tamano-pr es unlabeled.";
function countField(field) {
  if (field === "-") return 0;
  if (!/^\d+$/.test(field)) return null;
  const value = Number(field);
  return Number.isSafeInteger(value) ? value : null;
}
function measure(text) {
  const rows = text.split("\n");
  if (rows.at(-1) === "") rows.pop();
  let lines = 0;
  for (const raw of rows) {
    const row = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(row);
    if (!match) return null;
    const added = countField(match[1]);
    const deleted = countField(match[2]);
    if (added === null || deleted === null) return null;
    const path = match[3];
    const base = path.slice(path.lastIndexOf("/") + 1);
    if (!LOCKS.has(base)) lines += added + deleted;
  }
  return { lines };
}
function readPull(env) {
  if (!env.GITHUB_EVENT_PATH) return { tag: "absent" };
  try {
    const pull = JSON.parse(
      readFileSync(env.GITHUB_EVENT_PATH, "utf8"),
    )?.pull_request;
    if (!pull || typeof pull !== "object" || Array.isArray(pull)) {
      return { tag: "unreadable" };
    }
    const labels = Array.isArray(pull.labels)
      ? pull.labels.flatMap((label) =>
          typeof label?.name === "string" ? [label.name] : [],
        )
      : [];
    const number = Number.isInteger(pull.number) ? pull.number : Number.NaN;
    const body = typeof pull.body === "string" ? pull.body : "";
    return { tag: "pull", labels, body, number };
  } catch {
    return { tag: "unreadable" };
  }
}
function bearer(env) {
  for (const key of ["GITHUB_TOKEN", "GH_TOKEN"]) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}
async function fetchTimeline(env, number) {
  const repo = env.GITHUB_REPOSITORY;
  if (typeof repo !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    return { fail: "repo" };
  }
  if (!Number.isInteger(number)) return { fail: "http" };
  let origin;
  try {
    origin = new URL(env.GITHUB_API_URL || "https://api.github.com").origin;
  } catch {
    return { fail: "http" };
  }
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "neutro-pr-authorship",
  };
  const token = bearer(env);
  if (token) headers.Authorization = `Bearer ${token}`;
  let url = `${origin}/repos/${repo}/issues/${number}/timeline?per_page=100`;
  const events = [];
  try {
    for (let page = 0; page < 10; page += 1) {
      const response = await fetch(url, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return { fail: "http" };
      const payload = await response.json();
      if (!Array.isArray(payload)) return { fail: "http" };
      for (const record of payload) {
        const action = record?.event;
        const named = record?.label?.name === LABEL;
        const on = action === "labeled" || action === "unlabeled";
        if (!on || !named) continue;
        const at = record.created_at;
        if (typeof at !== "string" || at === "") return { fail: "http" };
        const login = record.actor?.login;
        const who = typeof login === "string" ? login : "";
        events.push({ action, at, login: who });
      }
      const link = response.headers.get("link") ?? "";
      const next = /<([^>]+)>\s*;\s*rel="next"/.exec(link);
      if (!next) return { events };
      const resolved = new URL(next[1], url);
      if (resolved.origin !== origin) return { fail: "http" };
      url = resolved.href;
    }
  } catch {
    return { fail: "http" };
  }
  return { fail: "http" };
}
function grant(events) {
  const last = events
    .toSorted((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .at(-1);
  if (!last) return { tag: "none" };
  if (last.action === "unlabeled") return { tag: "off" };
  if (last.login !== ACTOR) return { tag: "actor", login: last.login };
  return { tag: "on" };
}
function sectionLines(raw) {
  let text = typeof raw === "string" ? raw : "";
  while (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  let fence = false;
  let comment = false;
  let capture = false;
  let seen = false;
  const lines = [];
  for (const line of text.split("\n")) {
    if (!comment && FENCE.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (line.includes("<!--")) {
      comment = !line.includes("-->");
      continue;
    }
    if (comment) {
      if (line.includes("-->")) comment = false;
      continue;
    }
    const heading = HEADING.exec(line);
    if (!heading) {
      if (capture) lines.push(line);
      continue;
    }
    if (capture) break;
    if (heading[1] === "Excepción de tamaño") {
      capture = true;
      seen = true;
    }
  }
  return seen ? lines : null;
}
function realDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const utc = new Date(Date.UTC(+match[1], match[2] - 1, +match[3]));
  return utc.toISOString().slice(0, 10) === value;
}
function claim(raw) {
  const section = sectionLines(raw);
  if (!section) return { problems: [SECTION_MISSING] };
  let motivo;
  let vence;
  for (const line of section) {
    if (motivo === undefined) {
      const match = MOTIVO_RE.exec(line);
      if (match) motivo = match[1].trim();
    }
    if (vence === undefined) {
      const match = VENCE_RE.exec(line);
      if (match) vence = match[1].trim();
    }
  }
  const problems = [];
  if (motivo === undefined) problems.push(MOTIVO_MISSING);
  else if (motivo === "") problems.push(MOTIVO_EMPTY);
  if (vence === undefined) problems.push(VENCE_MISSING);
  else if (!realDate(vence)) problems.push(VENCE_BAD);
  return problems.length > 0 ? { problems } : { vence };
}
function summary(authorship, extra) {
  const lines = [`Autoría: ${authorship.lines}`, `Tope: ${LIMIT}`];
  if (extra) lines.push(extra);
  return `${lines.join("\n")}\n`;
}
function stack(lines) {
  return [
    `Este PR tiene ${lines} líneas de autoría (adiciones + eliminaciones, sin lockfiles). El tope es 1000.`,
    "Partilo en una cadena: la base de cada PR es el head del anterior, y se mergean en ese orden.",
  ];
}
function finish(code, stdout, stderr) {
  return { code, stdout, stderr };
}
function decide(authorship, today, pull, timeline) {
  if (authorship.lines <= LIMIT) return finish(0, summary(authorship), "");
  const stdout = summary(authorship);
  const fail = (reasons) =>
    finish(
      1,
      stdout,
      `${[...reasons, ...stack(authorship.lines)].join("\n")}\n`,
    );
  if (pull.tag === "unreadable") return finish(2, stdout, `${EVENT_FAIL}\n`);
  if (pull.tag !== "pull" || !pull.labels.includes(LABEL)) return fail([]);
  if (timeline.fail) {
    const sentence = timeline.fail === "repo" ? REPO_FAIL : TIMELINE_FAIL;
    return finish(2, stdout, `${sentence}\n`);
  }
  const granted = grant(timeline.events);
  if (granted.tag === "off") return fail([UNLABELED]);
  if (granted.tag === "none") return fail([NO_EVENT]);
  if (granted.tag === "actor") {
    return fail([
      `El último labeled es de ${granted.login}, no de JPGallegos1.`,
    ]);
  }
  const parsed = claim(pull.body);
  if (parsed.problems) return fail([CLAIM_FAIL, ...parsed.problems]);
  if (today > parsed.vence) {
    return fail([`La excepción venció el ${parsed.vence} (hoy UTC ${today}).`]);
  }
  return finish(
    0,
    summary(authorship, `Excepción vigente hasta ${parsed.vence}`),
    "",
  );
}
async function evaluate(env) {
  if (!env.BASE_SHA || !env.HEAD_SHA) return finish(2, "", `${NEED_SHA}\n`);
  if (!SHA.test(env.BASE_SHA) || !SHA.test(env.HEAD_SHA)) {
    return finish(2, "", `${BAD_SHA}\n`);
  }
  let text;
  try {
    text = execFileSync(
      "git",
      ["diff", "--numstat", `${env.BASE_SHA}...${env.HEAD_SHA}`],
      {
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 16 << 20,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    return finish(2, "", `${GIT_FAIL}\n`);
  }
  const authorship = measure(text);
  if (!authorship) return finish(2, "", `${NUMSTAT_FAIL}\n`);
  const today = new Date().toISOString().slice(0, 10);
  if (authorship.lines <= LIMIT) {
    return decide(authorship, today, { tag: "absent" }, {});
  }
  const pull = readPull(env);
  const timeline =
    pull.tag === "pull" && pull.labels.includes(LABEL)
      ? await fetchTimeline(env, pull.number)
      : {};
  return decide(authorship, today, pull, timeline);
}
async function main() {
  const verdict = await evaluate(process.env);
  process.stdout.write(verdict.stdout);
  process.stderr.write(verdict.stderr);
  process.exit(verdict.code);
}
const entry = process.argv[1];
if (
  entry &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry)
) {
  await main();
}
