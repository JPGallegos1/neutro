import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HOOKS_PATH = "tools/git-hooks";

export function isContinuousIntegration(env = process.env) {
  return env.CI === "true" || env.CI === "1" || env.GITHUB_ACTIONS === "true";
}

function repoRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function installGitHooks(env = process.env) {
  if (isContinuousIntegration(env)) {
    return { installed: false };
  }
  let top;
  try {
    top = repoRoot();
  } catch {
    return { installed: false };
  }
  try {
    if (realpathSync(process.cwd()) !== realpathSync(top)) {
      return { installed: false };
    }
  } catch {
    return { installed: false };
  }
  try {
    execFileSync("git", ["config", "core.hooksPath", HOOKS_PATH], {
      stdio: "ignore",
    });
  } catch {
    return { installed: false };
  }
  return { installed: true };
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
  installGitHooks();
}
