import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { classifyChangedPaths } from "./check-pr-file-count.mjs";

const script = fileURLToPath(
  new URL("./check-pr-file-count.mjs", import.meta.url),
);

const LOCKFILE_BASENAMES = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
];

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(cwd, message) {
  git(cwd, [
    "-c",
    "user.email=ci@example.com",
    "-c",
    "user.name=ci",
    "commit",
    "-m",
    message,
  ]);
}

function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "neutro-file-count-"));
  git(cwd, ["init", "-b", "main"]);
  writeFileSync(join(cwd, "keep.txt"), "keep");
  git(cwd, ["add", "-A"]);
  commit(cwd, "base");
  return cwd;
}

function runCheck(cwd, baseSha, headSha) {
  const env = { ...process.env };
  delete env.BASE_SHA;
  delete env.HEAD_SHA;
  if (baseSha) {
    env.BASE_SHA = baseSha;
  }
  if (headSha) {
    env.HEAD_SHA = headSha;
  }
  return spawnSync(process.execPath, [script], {
    cwd,
    env,
    encoding: "utf8",
  });
}

describe("classifyChangedPaths", () => {
  it("excluye lockfiles por basename, también en subcarpetas", () => {
    const paths = [
      "pnpm-lock.yaml",
      "apps/web/pnpm-lock.yaml",
      "package-lock.json",
      "packages/ui/yarn.lock",
      "bun.lock",
      "vendor/bun.lockb",
      "src/index.ts",
      "docs/pnpm-lock.yaml.txt",
      "bun.lockfile",
      "tools/ci/check-pr-file-count.mjs",
    ];
    const { excluded, counted, limit } = classifyChangedPaths(paths);
    assert.deepEqual(excluded, [
      "pnpm-lock.yaml",
      "apps/web/pnpm-lock.yaml",
      "package-lock.json",
      "packages/ui/yarn.lock",
      "bun.lock",
      "vendor/bun.lockb",
    ]);
    assert.deepEqual(counted, [
      "src/index.ts",
      "docs/pnpm-lock.yaml.txt",
      "bun.lockfile",
      "tools/ci/check-pr-file-count.mjs",
    ]);
    assert.equal(limit, 10);
    for (const basename of LOCKFILE_BASENAMES) {
      assert.equal(
        classifyChangedPaths([`dir/${basename}`]).excluded.length,
        1,
        basename,
      );
    }
  });

  it("deja pasar 10 archivos contados y falla con 11", () => {
    const ten = Array.from({ length: 10 }, (_, index) => `src/f${index}.ts`);
    const atLimit = classifyChangedPaths([...ten, "pnpm-lock.yaml"]);
    assert.equal(atLimit.counted.length, 10);
    assert.equal(atLimit.excluded.length, 1);
    assert.equal(atLimit.counted.length > atLimit.limit, false);

    const eleven = Array.from({ length: 11 }, (_, index) => `src/f${index}.ts`);
    const over = classifyChangedPaths([...eleven, "nested/package-lock.json"]);
    assert.equal(over.counted.length, 11);
    assert.deepEqual(over.excluded, ["nested/package-lock.json"]);
    assert.equal(over.counted.length > over.limit, true);
  });

  it("acepta cero archivos", () => {
    const none = classifyChangedPaths([]);
    assert.deepEqual(none.counted, []);
    assert.deepEqual(none.excluded, []);
    assert.equal(none.counted.length > none.limit, false);
  });
});

describe("check-pr-file-count.mjs", () => {
  it("al importarse no corre main ni exige los SHA", () => {
    assert.equal(typeof classifyChangedPaths, "function");
    assert.deepEqual(classifyChangedPaths([]).counted, []);
  });

  it("sale 2 si faltan BASE_SHA o HEAD_SHA", () => {
    const cwd = initRepo();
    try {
      const missing = runCheck(cwd);
      assert.equal(missing.status, 2);
      assert.equal(missing.stderr, "BASE_SHA and HEAD_SHA are required.\n");

      const head = git(cwd, ["rev-parse", "HEAD"]);
      const onlyHead = runCheck(cwd, undefined, head);
      assert.equal(onlyHead.status, 2);
      assert.equal(onlyHead.stderr, "BASE_SHA and HEAD_SHA are required.\n");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("con cero archivos el exit es 0 y el mensaje dice 0", () => {
    const cwd = initRepo();
    try {
      const sha = git(cwd, ["rev-parse", "HEAD"]);
      const result = runCheck(cwd, sha, sha);
      assert.equal(result.status, 0);
      assert.equal(result.stderr, "");
      assert.equal(
        result.stdout,
        [
          "PR file count (excluding lockfiles): 0",
          "Limit: 10",
          "Counted files:",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("10 archivos contados más un lockfile anidado pasan", () => {
    const cwd = initRepo();
    try {
      const base = git(cwd, ["rev-parse", "HEAD"]);
      mkdirSync(join(cwd, "nested"));
      for (let index = 0; index < 10; index += 1) {
        writeFileSync(join(cwd, `f${index}.txt`), `${index}`);
      }
      writeFileSync(join(cwd, "nested", "pnpm-lock.yaml"), "lock");
      git(cwd, ["add", "-A"]);
      commit(cwd, "ten");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      const result = runCheck(cwd, base, head);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.match(
        result.stdout,
        /^PR file count \(excluding lockfiles\): 10\nLimit: 10\nExcluded lockfiles:\n {2}- nested\/pnpm-lock\.yaml\nCounted files:\n/,
      );
      for (let index = 0; index < 10; index += 1) {
        assert.match(result.stdout, new RegExp(`^ {2}- f${index}\\.txt$`, "m"));
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("11 archivos contados fallan con el mensaje actual", () => {
    const cwd = initRepo();
    try {
      const base = git(cwd, ["rev-parse", "HEAD"]);
      for (let index = 0; index < 11; index += 1) {
        writeFileSync(join(cwd, `f${index}.txt`), `${index}`);
      }
      writeFileSync(join(cwd, "yarn.lock"), "lock");
      git(cwd, ["add", "-A"]);
      commit(cwd, "eleven");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      const result = runCheck(cwd, base, head);
      assert.equal(result.status, 1);
      assert.match(
        result.stdout,
        /^PR file count \(excluding lockfiles\): 11\nLimit: 10\nExcluded lockfiles:\n {2}- yarn\.lock\nCounted files:\n/,
      );
      assert.doesNotMatch(
        result.stdout.split("Counted files:")[1],
        /yarn\.lock/,
      );
      assert.equal(
        result.stderr,
        [
          "",
          "This PR changes 11 files (limit 10, lockfiles excluded).",
          "Split the work into smaller stacked PRs (about 7–10 authored files each) and rebase dependents onto the smaller bases.",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("cuenta un rename por su destino y un borrado como archivos", () => {
    const cwd = initRepo();
    try {
      writeFileSync(join(cwd, "gone.txt"), "gone");
      writeFileSync(join(cwd, "old-name.txt"), "old");
      git(cwd, ["add", "-A"]);
      commit(cwd, "paths");
      const base = git(cwd, ["rev-parse", "HEAD"]);
      git(cwd, ["mv", "old-name.txt", "new-name.txt"]);
      git(cwd, ["rm", "gone.txt"]);
      commit(cwd, "rename-and-delete");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      const listed = git(cwd, ["diff", "--name-only", `${base}...${head}`])
        .split("\n")
        .filter(Boolean);
      assert.deepEqual(listed.sort(), ["gone.txt", "new-name.txt"]);
      const { counted, excluded } = classifyChangedPaths(listed);
      assert.deepEqual(excluded, []);
      assert.deepEqual(counted.sort(), ["gone.txt", "new-name.txt"]);
      const result = runCheck(cwd, base, head);
      assert.equal(result.status, 0, result.stderr);
      assert.match(
        result.stdout,
        /^PR file count \(excluding lockfiles\): 2\n/,
      );
      assert.match(result.stdout, /^ {2}- gone\.txt$/m);
      assert.match(result.stdout, /^ {2}- new-name\.txt$/m);
      assert.doesNotMatch(result.stdout, /old-name\.txt/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
