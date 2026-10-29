import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  disallowedTrackedEnvPaths,
  isDisallowedTrackedEnv,
} from "./check-tracked-env.mjs";

const script = fileURLToPath(
  new URL("./check-tracked-env.mjs", import.meta.url),
);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commitAll(cwd) {
  git(cwd, ["add", "-A"]);
  git(cwd, [
    "-c",
    "user.email=ci@example.com",
    "-c",
    "user.name=ci",
    "commit",
    "-m",
    "fixture",
  ]);
}

function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "neutro-tracked-env-"));
  git(cwd, ["init", "-b", "main"]);
  writeFileSync(join(cwd, "README.md"), "ok");
  commitAll(cwd);
  return cwd;
}

function runCheck(cwd) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
  });
}

describe("isDisallowedTrackedEnv", () => {
  it("rechaza .env y .dev.vars que no terminan en .example", () => {
    const red = [
      ".env",
      ".env.local",
      ".env.production",
      ".env.example.txt",
      "apps/web/.env",
      "apps/web/.env.local",
      "apps/web/.dev.vars",
      "apps/web/.dev.vars.local",
      "nested/.dev.vars.production",
      ".dev.vars.bak",
    ];
    for (const path of red) {
      assert.equal(isDisallowedTrackedEnv(path), true, path);
    }
    assert.deepEqual(disallowedTrackedEnvPaths(red), red);
  });

  it("acepta ejemplos y nombres que no son archivos de entorno", () => {
    const green = [
      ".env.example",
      ".env.production.example",
      "apps/web/.env.example",
      "apps/web/.dev.vars.example",
      "apps/web/.dev.vars.local.example",
      ".envrc",
      "notes.env",
      "env.example",
      "src/.environment",
      "README.md",
      ".dev.vars.example",
    ];
    for (const path of green) {
      assert.equal(isDisallowedTrackedEnv(path), false, path);
    }
    assert.deepEqual(disallowedTrackedEnvPaths(green), []);
  });
});

describe("check-tracked-env.mjs", () => {
  it("sale 0 si el índice solo tiene ejemplos", () => {
    const cwd = initRepo();
    try {
      mkdirSync(join(cwd, "apps", "web"), { recursive: true });
      writeFileSync(join(cwd, ".env.example"), "PUBLIC_POSTHOG_KEY=\n");
      writeFileSync(join(cwd, ".env.production.example"), "A=1\n");
      writeFileSync(join(cwd, "apps", "web", ".dev.vars.example"), "A=1\n");
      writeFileSync(join(cwd, ".envrc"), "export A=1\n");
      commitAll(cwd);
      const result = runCheck(cwd);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(result.stdout, "");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("sale 1 y lista los .env y .dev.vars trackeados", () => {
    const cwd = initRepo();
    try {
      mkdirSync(join(cwd, "apps", "web"), { recursive: true });
      writeFileSync(join(cwd, ".env"), "A=1\n");
      writeFileSync(join(cwd, ".env.local"), "A=1\n");
      writeFileSync(join(cwd, "apps", "web", ".dev.vars"), "A=1\n");
      writeFileSync(join(cwd, "apps", "web", ".env.example"), "A=\n");
      commitAll(cwd);
      const result = runCheck(cwd);
      assert.equal(result.status, 1);
      assert.equal(
        result.stderr,
        [
          "Hay archivos de entorno trackeados que no terminan en .example:",
          "  - .env",
          "  - .env.local",
          "  - apps/web/.dev.vars",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
