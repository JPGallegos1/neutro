import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isDisallowedTrackedEnv(path) {
  const name = path.split("/").pop() ?? path;
  const trackedEnv =
    name === ".env" ||
    name.startsWith(".env.") ||
    name === ".dev.vars" ||
    name.startsWith(".dev.vars.");
  if (!trackedEnv) {
    return false;
  }
  return !name.endsWith(".example");
}

export function disallowedTrackedEnvPaths(paths) {
  return paths.filter((path) => isDisallowedTrackedEnv(path));
}

function listedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function main() {
  const disallowed = disallowedTrackedEnvPaths(listedFiles());
  if (disallowed.length === 0) {
    return;
  }
  console.error(
    "Hay archivos de entorno trackeados que no terminan en .example:",
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
