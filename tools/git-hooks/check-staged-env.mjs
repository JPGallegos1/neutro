import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isDisallowedEnvPath(path) {
  const name = path.split("/").pop() ?? path;
  const envFile =
    name === ".env" ||
    name.startsWith(".env.") ||
    name === ".dev.vars" ||
    name.startsWith(".dev.vars.");
  if (!envFile) {
    return false;
  }
  return !name.endsWith(".example");
}

export function disallowedEnvPaths(paths) {
  return paths.filter((path) => isDisallowedEnvPath(path));
}

function stagedFiles() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" },
  );
  return output.split("\0").filter(Boolean);
}

function main() {
  const disallowed = disallowedEnvPaths(stagedFiles());
  if (disallowed.length === 0) {
    return;
  }
  console.error(
    "No se puede commitear un .env o .dev.vars que no termine en .example:",
  );
  for (const path of disallowed) {
    console.error(`  - ${path}`);
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
