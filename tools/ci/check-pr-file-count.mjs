import { execFileSync } from "node:child_process";

const MAX_FILES = 10;

const EXCLUDED_BASENAMES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
]);

function basename(path) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function listedFiles(baseSha, headSha) {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `${baseSha}...${headSha}`],
    { encoding: "utf8" },
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA;

  if (!baseSha || !headSha) {
    console.error("BASE_SHA and HEAD_SHA are required.");
    process.exit(2);
  }

  const changed = listedFiles(baseSha, headSha);
  const excluded = changed.filter((path) => EXCLUDED_BASENAMES.has(basename(path)));
  const counted = changed.filter((path) => !EXCLUDED_BASENAMES.has(basename(path)));

  console.log(`PR file count (excluding lockfiles): ${counted.length}`);
  console.log(`Limit: ${MAX_FILES}`);
  if (excluded.length > 0) {
    console.log("Excluded lockfiles:");
    for (const path of excluded) {
      console.log(`  - ${path}`);
    }
  }
  console.log("Counted files:");
  for (const path of counted) {
    console.log(`  - ${path}`);
  }

  if (counted.length > MAX_FILES) {
    console.error("");
    console.error(
      `This PR changes ${counted.length} files (limit ${MAX_FILES}, lockfiles excluded).`,
    );
    console.error(
      "Split the work into smaller stacked PRs (about 7–10 authored files each) and rebase dependents onto the smaller bases.",
    );
    process.exit(1);
  }
}

main();
