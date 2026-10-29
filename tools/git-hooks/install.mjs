import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const HOOKS_PATH = "tools/git-hooks";

export function isContinuousIntegration(env = process.env) {
  return env.CI === "true" || env.CI === "1" || env.GITHUB_ACTIONS === "true";
}

const OTHER_HOOKS_PATH_WARNING =
  "No se instalaron los hooks de Neutro: el repo ya tiene otro core.hooksPath.";

function gitOutput(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function repoRoot() {
  return gitOutput(["rev-parse", "--show-toplevel"]);
}

function configuredHooksPath() {
  try {
    return gitOutput(["config", "--local", "--get", "core.hooksPath"]);
  } catch {
    return "";
  }
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
  const current = configuredHooksPath();
  if (current !== "" && current !== HOOKS_PATH) {
    console.error(OTHER_HOOKS_PATH_WARNING);
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
