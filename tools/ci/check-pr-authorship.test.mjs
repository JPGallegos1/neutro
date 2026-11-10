import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(
  new URL("./check-pr-authorship.mjs", import.meta.url),
);
const LABEL = "excepcion-tamano-pr";
const LOCKS =
  "bun.lock bun.lockb package-lock.json pnpm-lock.yaml yarn.lock".split(" ");
function git(cwd, args) {
  return execFileSync("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
  }).trim();
}
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), "neutro-a-"));
  git(cwd, ["init", "-b", "main"]);
  writeFileSync(join(cwd, "k.txt"), "k\n");
  git(cwd, ["add", "-A"]);
  git(cwd, ["commit", "-m", "b"]);
  return cwd;
}
function commit(cwd) {
  git(cwd, ["add", "-A"]);
  git(cwd, ["commit", "-m", "c"]);
}
const head = (cwd) => git(cwd, ["rev-parse", "HEAD"]);
const drop = (p) => rmSync(p, { recursive: true, force: true });
function run(cwd, env = {}) {
  const cleaned = { ...process.env };
  const keys =
    "BASE_SHA HEAD_SHA GITHUB_EVENT_PATH GITHUB_TOKEN GH_TOKEN GITHUB_REPOSITORY GITHUB_API_URL";
  for (const key of keys.split(" ")) delete cleaned[key];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...cleaned, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ status: code, stdout, stderr }));
  });
}
function shas(cwd, base, extra) {
  return run(cwd, { BASE_SHA: base, HEAD_SHA: head(cwd), ...extra });
}
function report(n) {
  return `Autoría: ${n}\nTope: 1000\n`;
}
function section(motivo, vence) {
  return `## Excepción de tamaño\n\n   * Motivo: ${motivo}\n\n   * Vence: ${vence}\n`;
}
function eventFile(cwd, pull) {
  const path = join(cwd, "event.json");
  writeFileSync(path, JSON.stringify({ pull_request: pull }));
  return path;
}
function ev(spec) {
  return spec.split("|").map((part) => {
    const [who, action, day, name] = part.trim().split(/\s+/);
    const login = who === "jp" ? "JPGallegos1" : who;
    const at = `${day}T00:00:00Z`;
    return {
      event: action,
      created_at: at,
      actor: { login },
      label: { name: name ?? LABEL },
    };
  });
}
function listen(handler) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.headers.authorization ?? null);
    handler(res, requests.length);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        requests,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
function json(res, payload, headers = {}) {
  res.writeHead(200, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(payload));
}
function bigRepo() {
  const cwd = repo();
  const base = head(cwd);
  writeFileSync(join(cwd, "big.txt"), "x\n".repeat(1001));
  commit(cwd);
  return { cwd, base };
}
async function withOver(handler, extra = {}) {
  const box = bigRepo();
  const api = await listen(handler);
  const pull = {
    number: 7,
    labels: [{ name: LABEL }],
    body: section("porque: sí", "2099-01-01"),
    ...extra.pull,
  };
  try {
    const result = await run(box.cwd, {
      BASE_SHA: box.base,
      HEAD_SHA: head(box.cwd),
      GITHUB_EVENT_PATH: eventFile(box.cwd, pull),
      GITHUB_API_URL: api.url,
      GITHUB_REPOSITORY: "neutro/neutro",
      ...extra.env,
    });
    return { result, requests: api.requests };
  } finally {
    drop(box.cwd);
    await api.close();
  }
}
describe("autoría del PR", () => {
  it("no exporta símbolos", async () => {
    const mod = await import("./check-pr-authorship.mjs");
    assert.deepEqual(Object.keys(mod), []);
  });
  it("sale 2 si falta un SHA", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "n-"));
    const result = await run(cwd, { HEAD_SHA: "abc1234" });
    assert.equal(result.status, 2);
    drop(cwd);
  });
  it("sale 2 si el SHA no es hexadecimal", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "n-"));
    const result = await run(cwd, { BASE_SHA: "zz", HEAD_SHA: "abc1234" });
    assert.equal(result.status, 2);
    drop(cwd);
  });
  it("los tres puntos no cuentan lo de la base", async () => {
    const cwd = repo();
    const root = head(cwd);
    writeFileSync(join(cwd, "only.txt"), "m\n");
    commit(cwd);
    const base = head(cwd);
    git(cwd, ["checkout", "-b", "feature", root]);
    writeFileSync(join(cwd, "feat.txt"), "f\n");
    commit(cwd);
    assert.equal((await shas(cwd, base)).stdout, report(1));
    drop(cwd);
  });
  it("1000 líneas pasan y los lockfiles quedan afuera", async () => {
    const cwd = repo();
    const base = head(cwd);
    writeFileSync(join(cwd, "app.txt"), "x\n".repeat(997));
    mkdirSync(join(cwd, "nested"));
    writeFileSync(join(cwd, "bun.lockfile"), "a\nb\nc\n");
    for (const name of LOCKS) {
      const n = name === "pnpm-lock.yaml" ? 4000 : 8;
      writeFileSync(join(cwd, `nested/${name}`), "z\n".repeat(n));
    }
    commit(cwd);
    const result = await shas(cwd, base);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^Autoría: 1000\n/);
    drop(cwd);
  });
  it("sobre el tope apila y bajo el tope no usa la red", async () => {
    const api = await listen(() => {
      throw new Error("x");
    });
    const over = bigRepo();
    const denied = await shas(over.cwd, over.base, {
      GITHUB_API_URL: api.url,
    });
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /El tope es 1000[\s\S]*head del anterior/);
    const under = repo();
    const pull = {
      number: 7,
      labels: [{ name: LABEL }],
      body: section("v", "2020-01-01"),
    };
    const allowed = await shas(under, head(under), {
      GITHUB_EVENT_PATH: eventFile(under, pull),
      GITHUB_API_URL: api.url,
    });
    assert.equal(allowed.status, 0);
    assert.equal(api.requests.length, 0);
    drop(over.cwd);
    drop(under);
    await api.close();
  });
  it("sale 2 si git diff falla", async () => {
    const cwd = repo();
    const missing = await run(cwd, {
      BASE_SHA: "aa".repeat(20),
      HEAD_SHA: "bb".repeat(20),
    });
    assert.equal(missing.status, 2);
    drop(cwd);
  });
  it("el token es opcional y JP autoriza", async () => {
    const rows = ev("jp labeled 2026-01-01");
    const open = await withOver((res) => json(res, rows));
    assert.equal(open.result.status, 0, open.result.stderr);
    assert.equal(open.requests[0], null);
    const token = await withOver((res) => json(res, rows), {
      env: { GH_TOKEN: "token-de-prueba" },
    });
    assert.equal(token.requests[0], "Bearer token-de-prueba");
  });
  it("sólo cuenta el último evento de ese label", async () => {
    const rows = [
      ["otra labeled 2026-01-01|jp labeled 2026-02-01", 0, null],
      ["jp labeled 2026-01-01|otra labeled 2026-02-01", 1, /otra/],
      ["jp labeled 2026-01-01|jp unlabeled 2026-03-01", 1, /unlabeled/],
      ["jp labeled 2026-01-01 otro", 1, /ni un unlabeled/],
    ];
    for (const [spec, status, pattern] of rows) {
      const seen = await withOver((res) => json(res, ev(spec)));
      assert.equal(seen.result.status, status, seen.result.stderr);
      if (pattern) assert.match(seen.result.stderr, pattern);
    }
  });
  it("un timeline o evento ilegible no autoriza", async () => {
    const down = createServer();
    await new Promise((ok) => down.listen(0, "127.0.0.1", ok));
    const port = down.address().port;
    await new Promise((ok) => down.close(ok));
    const refused = await withOver(() => {}, {
      env: { GITHUB_API_URL: `http://127.0.0.1:${port}` },
    });
    assert.equal(refused.result.status, 2);
  });
  it("exige Motivo y Vence, con fecha UTC", async () => {
    const grant = (res) => json(res, ev("jp labeled 2026-01-01"));
    const empty = "## Excepción de tamaño\n- Motivo:\n- Vence: 2026-02-31";
    const bad = await withOver(grant, { pull: { body: empty } });
    assert.match(bad.result.stderr, /Motivo está vacío[\s\S]*YYYY-MM-DD/);
    const today = new Date().toISOString().slice(0, 10);
    const ms = Date.now() - 86_400_000;
    const yesterday = new Date(ms).toISOString().slice(0, 10);
    const fresh = await withOver(grant, {
      pull: { body: section("sigue", today) },
    });
    assert.equal(fresh.result.status, 0);
    const staleBody = `\uFEFF## Excepción de tamaño\r\n- Motivo: x\r\n- Vence: ${yesterday}\r\n`;
    const stale = await withOver(grant, { pull: { body: staleBody } });
    assert.match(stale.result.stderr, new RegExp(today));
  });
});
