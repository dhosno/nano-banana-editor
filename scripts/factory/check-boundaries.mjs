import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_CHANGED_FILES = 50;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

const PROTECTED_FILES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "bun.lock",
  "bun.lockb",
  "deno.lock",
  ".npmrc",
  ".gitattributes",
  ".yarnrc",
  ".yarnrc.yml",
  ".pnpmfile.cjs",
  ".node-version",
  ".nvmrc",
  "AGENTS.md",
  "AGENTS.override.md",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "tsconfig.json",
  "jsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "postcss.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs",
  "tailwind.config.ts",
  "scripts/run-factory.mjs",
]);

const PROTECTED_PREFIXES = [
  ".git",
  ".github/",
  ".codex/",
  ".factory/",
  "scripts/factory/",
];

function normalizeChangedPath(candidatePath) {
  if (
    typeof candidatePath !== "string" ||
    candidatePath.length === 0 ||
    candidatePath.includes("\0")
  ) {
    throw new Error("Candidate contains an invalid changed path");
  }

  const normalized = candidatePath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Candidate contains a non-repository path: ${candidatePath}`);
  }

  return normalized;
}

export function validateChangedPaths(paths) {
  if (paths.length === 0) {
    throw new Error("Candidate contains no repository changes");
  }

  if (paths.length > MAX_CHANGED_FILES) {
    throw new Error(`Candidate changes too many files: ${paths.length}`);
  }

  const blocked = paths
    .map(normalizeChangedPath)
    .filter(
      (path) =>
        PROTECTED_FILES.has(path) ||
        PROTECTED_FILES.has(basename(path)) ||
        PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix)),
    );

  if (blocked.length > 0) {
    throw new Error(`Candidate modifies protected factory paths: ${blocked.join(", ")}`);
  }

  return paths;
}

export function validateCandidateSizes(paths) {
  let totalBytes = 0;

  for (const path of paths) {
    let stats;
    try {
      stats = lstatSync(path);
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    if (stats.isSymbolicLink()) {
      throw new Error(`Candidate adds or changes a symbolic link: ${path}`);
    }

    if (!stats.isFile()) {
      continue;
    }

    if (stats.size > MAX_FILE_BYTES) {
      throw new Error(`Candidate file exceeds 5 MB: ${path}`);
    }

    totalBytes += stats.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error("Candidate files exceed the 10 MB total limit");
  }
}

function changedPathsFromGit() {
  const output = execFileSync(
    "git",
    ["diff", "HEAD", "--name-only", "--no-renames", "-z"],
    { encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const paths = validateChangedPaths(changedPathsFromGit());
    validateCandidateSizes(paths);
    console.log(`Factory boundary check passed for ${paths.length} changed path(s).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
