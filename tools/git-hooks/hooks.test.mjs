import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  disallowedEnvPaths,
  isDisallowedEnvPath,
} from "./check-staged-env.mjs";
import { HOOKS_PATH, isContinuousIntegration } from "./install.mjs";

const stagedScript = fileURLToPath(
  new URL("./check-staged-env.mjs", import.meta.url),
);
const installScript = fileURLToPath(new URL("./install.mjs", import.meta.url));
const hookScript = fileURLToPath(new URL("./pre-commit", import.meta.url));

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
  const cwd = mkdtempSync(join(tmpdir(), "neutro-hooks-"));
  git(cwd, ["init", "-b", "main"]);
  writeFileSync(join(cwd, "README.md"), "ok");
  commitAll(cwd);
  return cwd;
}

function withoutCi(extra = {}) {
  const env = { ...process.env };
  delete env.CI;
  delete env.GITHUB_ACTIONS;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return { ...env, ...extra };
}

function localHooksPath(cwd) {
  const result = spawnSync(
    "git",
    ["config", "--local", "--get", "core.hooksPath"],
    { cwd, encoding: "utf8" },
  );
  if (result.status === 1) {
    return "";
  }
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function nodePath() {
  return `${dirname(process.execPath)}:/usr/bin:/bin`;
}

describe("isDisallowedEnvPath", () => {
  it("rechaza .env y .dev.vars que no terminan en .example", () => {
    const red = [
      ".env",
      ".env.local",
      ".env.production",
      "apps/web/.dev.vars",
      "apps/web/.dev.vars.local",
    ];
    for (const path of red) {
      assert.equal(isDisallowedEnvPath(path), true, path);
    }
    assert.deepEqual(disallowedEnvPaths(red), red);
  });

  it("acepta ejemplos y otros nombres", () => {
    const green = [
      ".env.example",
      ".env.production.example",
      "apps/web/.dev.vars.example",
      ".envrc",
      "notes.env",
      "README.md",
    ];
    for (const path of green) {
      assert.equal(isDisallowedEnvPath(path), false, path);
    }
    assert.deepEqual(disallowedEnvPaths(green), []);
  });
});

describe("check-staged-env.mjs", () => {
  it("sale 0 con un .env.example staged", () => {
    const cwd = initRepo();
    try {
      writeFileSync(join(cwd, ".env.example"), "A=\n");
      writeFileSync(join(cwd, ".dev.vars.example"), "A=\n");
      git(cwd, ["add", "-A"]);
      const result = spawnSync(process.execPath, [stagedScript], {
        cwd,
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("sale 1 y lista el .env y el .dev.vars staged", () => {
    const cwd = initRepo();
    try {
      mkdirSync(join(cwd, "apps", "web"), { recursive: true });
      writeFileSync(join(cwd, ".env"), "A=1\n");
      writeFileSync(join(cwd, "apps", "web", ".dev.vars"), "A=1\n");
      writeFileSync(join(cwd, ".env.example"), "A=\n");
      git(cwd, ["add", "-A"]);
      const result = spawnSync(process.execPath, [stagedScript], {
        cwd,
        encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.equal(
        result.stderr,
        [
          "No se puede commitear un .env o .dev.vars que no termine en .example:",
          "  - .env",
          "  - apps/web/.dev.vars",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("pre-commit", () => {
  it("falla con instrucciones si gitleaks no está instalado", () => {
    const cwd = initRepo();
    try {
      writeFileSync(join(cwd, "ok.txt"), "ok");
      git(cwd, ["add", "ok.txt"]);
      const result = spawnSync("sh", [hookScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi({ PATH: nodePath() }),
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /gitleaks no está instalado/);
      assert.match(result.stderr, /8\.30\.1/);
      assert.match(result.stderr, /brew install gitleaks/);
      assert.match(result.stderr, /El hook no descarga el binario/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("no llama a gitleaks si hay un .env staged", () => {
    const cwd = initRepo();
    const bin = mkdtempSync(join(tmpdir(), "neutro-fake-gitleaks-"));
    const argsFile = join(cwd, "args.txt");
    try {
      writeFileSync(
        join(bin, "gitleaks"),
        '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$GITLEAKS_ARGS_FILE"\nexit 0\n',
      );
      chmodSync(join(bin, "gitleaks"), 0o755);
      writeFileSync(join(cwd, ".env"), "A=1\n");
      git(cwd, ["add", ".env"]);
      const result = spawnSync("sh", [hookScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi({
          PATH: `${bin}:${nodePath()}`,
          GITLEAKS_ARGS_FILE: argsFile,
        }),
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /No se puede commitear/);
      assert.equal(existsSync(argsFile), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(bin, { recursive: true, force: true });
    }
  });

  it("corre gitleaks git --pre-commit --staged --redact", () => {
    const cwd = initRepo();
    const bin = mkdtempSync(join(tmpdir(), "neutro-fake-gitleaks-"));
    const argsFile = join(cwd, "args.txt");
    try {
      writeFileSync(
        join(bin, "gitleaks"),
        '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$GITLEAKS_ARGS_FILE"\nexit "${GITLEAKS_EXIT:-0}"\n',
      );
      chmodSync(join(bin, "gitleaks"), 0o755);
      writeFileSync(join(cwd, "ok.txt"), "ok");
      git(cwd, ["add", "ok.txt"]);
      const ok = spawnSync("sh", [hookScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi({
          PATH: `${bin}:${nodePath()}`,
          GITLEAKS_ARGS_FILE: argsFile,
          GITLEAKS_EXIT: "0",
        }),
      });
      assert.equal(ok.status, 0, ok.stderr);
      assert.equal(
        execFileSync("cat", [argsFile], { encoding: "utf8" }),
        "git\n--pre-commit\n--staged\n--redact\n--verbose\n--no-banner\n--no-color\n",
      );
      const failed = spawnSync("sh", [hookScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi({
          PATH: `${bin}:${nodePath()}`,
          GITLEAKS_ARGS_FILE: argsFile,
          GITLEAKS_EXIT: "3",
        }),
      });
      assert.equal(failed.status, 3);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(bin, { recursive: true, force: true });
    }
  });
});

describe("install.mjs", () => {
  it("reconoce CI y GitHub Actions", () => {
    assert.equal(isContinuousIntegration({}), false);
    assert.equal(isContinuousIntegration({ CI: "true" }), true);
    assert.equal(isContinuousIntegration({ CI: "1" }), true);
    assert.equal(isContinuousIntegration({ CI: "false" }), false);
    assert.equal(isContinuousIntegration({ GITHUB_ACTIONS: "true" }), true);
  });

  it("apunta core.hooksPath fuera de CI y no lo toca en CI", () => {
    const cwd = initRepo();
    try {
      const skipped = spawnSync(process.execPath, [installScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi({ CI: "true" }),
      });
      assert.equal(skipped.status, 0, skipped.stderr);
      assert.equal(localHooksPath(cwd), "");

      const installed = spawnSync(process.execPath, [installScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi(),
      });
      assert.equal(installed.status, 0, installed.stderr);
      assert.equal(localHooksPath(cwd), HOOKS_PATH);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("sale 0 si el directorio no es un repo", () => {
    const cwd = mkdtempSync(join(tmpdir(), "neutro-not-git-"));
    try {
      const result = spawnSync(process.execPath, [installScript], {
        cwd,
        encoding: "utf8",
        env: withoutCi(),
      });
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
