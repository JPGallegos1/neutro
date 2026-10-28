import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HOOKS_PATH = "tools/git-hooks";

export function isContinuousIntegration(env = process.env) {
  return env.CI === "true" || env.CI === "1" || env.GITHUB_ACTIONS === "true";
}

export function installGitHooks(env = process.env) {
  if (isContinuousIntegration(env)) {
    return { installed: false };
  }
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "ignore" });
  } catch {
    return { installed: false };
  }
  execFileSync("git", ["config", "core.hooksPath", HOOKS_PATH], {
    stdio: "ignore",
  });
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
