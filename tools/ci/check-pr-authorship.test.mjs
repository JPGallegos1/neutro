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
const head = (cwd) => git(cwd, ["rev-parse", "HEAD"]);
const drop = (p) => rmSync(p, { recursive: true, force: true });
function commit(cwd) {
  git(cwd, ["add", "-A"]);
  git(cwd, ["commit", "-m", "c"]);
}
function run(cwd, env = {}) {
  const cleaned = { ...process.env };
  for (const key of "BASE_SHA HEAD_SHA GITHUB_EVENT_PATH GITHUB_TOKEN GH_TOKEN GITHUB_REPOSITORY GITHUB_API_URL".split(
    " ",
  )) {
    delete cleaned[key];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...cleaned, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ status: code, stdout, stderr }));
  });
}
const shas = (cwd, base, extra) =>
  run(cwd, { BASE_SHA: base, HEAD_SHA: head(cwd), ...extra });
const section = (motivo, vence) =>
  `## Excepción de tamaño\n\n   * Motivo: ${motivo}\n\n   * Vence: ${vence}\n`;
function eventFile(cwd, pull) {
  const path = join(cwd, "event.json");
  writeFileSync(path, JSON.stringify({ pull_request: pull }));
  return path;
}
function ev(spec) {
  return spec.split("|").map((part) => {
    const [who, action, day, name] = part.trim().split(/\s+/);
    return {
      event: action,
      created_at: `${day}T00:00:00Z`,
      actor: { login: who === "jp" ? "JPGallegos1" : who },
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
const json = (res, payload) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};
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
    return {
      result: await run(box.cwd, {
        BASE_SHA: box.base,
        HEAD_SHA: head(box.cwd),
        GITHUB_EVENT_PATH: eventFile(box.cwd, pull),
        GITHUB_API_URL: api.url,
        GITHUB_REPOSITORY: "neutro/neutro",
        ...extra.env,
      }),
      requests: api.requests,
    };
  } finally {
    drop(box.cwd);
    await api.close();
  }
}
describe("autoría del PR", () => {
  it("sin exports; SHA inválido o git en rojo sale 2", async () => {
    assert.deepEqual(
      Object.keys(await import("./check-pr-authorship.mjs")),
      [],
    );
    const cwd = repo();
    assert.equal((await run(cwd, { HEAD_SHA: "abc1234" })).status, 2);
    assert.equal(
      (await run(cwd, { BASE_SHA: "zz", HEAD_SHA: "abc1234" })).status,
      2,
    );
    assert.equal(
      (
        await run(cwd, {
          BASE_SHA: "aa".repeat(20),
          HEAD_SHA: "bb".repeat(20),
        })
      ).status,
      2,
    );
    drop(cwd);
  });
  it("1000 pasan; lockfiles afuera; tres puntos ignoran la base", async () => {
    const cwd = repo();
    const root = head(cwd);
    writeFileSync(join(cwd, "only.txt"), "m\n");
    commit(cwd);
    const side = head(cwd);
    git(cwd, ["checkout", "-b", "feature", root]);
    writeFileSync(join(cwd, "app.txt"), "x\n".repeat(997));
    mkdirSync(join(cwd, "nested"));
    writeFileSync(join(cwd, "bun.lockfile"), "a\nb\nc\n");
    for (const name of LOCKS) {
      writeFileSync(
        join(cwd, `nested/${name}`),
        "z\n".repeat(name.startsWith("pnpm") ? 4000 : 8),
      );
    }
    commit(cwd);
    const ok = await shas(cwd, side);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /^Autoría: 1000\n/);
    drop(cwd);
  });
  it("sobre el tope apila; bajo el tope no usa la red", async () => {
    const api = await listen(() => {
      throw new Error("x");
    });
    const over = bigRepo();
    const denied = await shas(over.cwd, over.base, { GITHUB_API_URL: api.url });
    assert.equal(denied.status, 1);
    assert.match(denied.stderr, /El tope es 1000[\s\S]*head del anterior/);
    const under = repo();
    const allowed = await shas(under, head(under), {
      GITHUB_EVENT_PATH: eventFile(under, {
        number: 7,
        labels: [{ name: LABEL }],
        body: section("v", "2020-01-01"),
      }),
      GITHUB_API_URL: api.url,
    });
    assert.equal(allowed.status, 0);
    assert.equal(api.requests.length, 0);
    drop(over.cwd);
    drop(under);
    await api.close();
  });
  it("token opcional; último evento del label; Motivo/Vence UTC", async () => {
    const rows = ev("jp labeled 2026-01-01");
    const open = await withOver((res) => json(res, rows));
    assert.equal(open.result.status, 0, open.result.stderr);
    assert.equal(open.requests[0], null);
    const token = await withOver((res) => json(res, rows), {
      env: { GH_TOKEN: "token-de-prueba" },
    });
    assert.equal(token.requests[0], "Bearer token-de-prueba");
    for (const [spec, status, pattern] of [
      ["otra labeled 2026-01-01|jp labeled 2026-02-01", 0, null],
      ["jp labeled 2026-01-01|otra labeled 2026-02-01", 1, /otra/],
      ["jp labeled 2026-01-01|jp unlabeled 2026-03-01", 1, /unlabeled/],
      ["jp labeled 2026-01-01 otro", 1, /ni un unlabeled/],
    ]) {
      const seen = await withOver((res) => json(res, ev(spec)));
      assert.equal(seen.result.status, status, seen.result.stderr);
      if (pattern) assert.match(seen.result.stderr, pattern);
    }
    const down = createServer();
    await new Promise((ok) => down.listen(0, "127.0.0.1", ok));
    const port = down.address().port;
    await new Promise((ok) => down.close(ok));
    assert.equal(
      (
        await withOver(() => {}, {
          env: { GITHUB_API_URL: `http://127.0.0.1:${port}` },
        })
      ).result.status,
      2,
    );
    const grant = (res) => json(res, rows);
    assert.match(
      (
        await withOver(grant, {
          pull: {
            body: "## Excepción de tamaño\n- Motivo:\n- Vence: 2026-02-31",
          },
        })
      ).result.stderr,
      /Motivo está vacío[\s\S]*YYYY-MM-DD/,
    );
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    assert.equal(
      (await withOver(grant, { pull: { body: section("sigue", today) } }))
        .result.status,
      0,
    );
    assert.match(
      (
        await withOver(grant, {
          pull: {
            body: `\uFEFF## Excepción de tamaño\r\n- Motivo: x\r\n- Vence: ${yesterday}\r\n`,
          },
        })
      ).result.stderr,
      new RegExp(today),
    );
  });
});
