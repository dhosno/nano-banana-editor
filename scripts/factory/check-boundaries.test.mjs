import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  validateCandidateSizes,
  validateChangedPaths,
} from "./check-boundaries.mjs";

test("accepts ordinary application and documentation changes", () => {
  assert.deepEqual(
    validateChangedPaths(["src/app/page.tsx", "README.md"]),
    ["src/app/page.tsx", "README.md"],
  );
});

test("rejects empty candidates", () => {
  assert.throws(() => validateChangedPaths([]), /no repository changes/);
});

for (const path of [
  ".github/workflows/escape.yml",
  ".github/codex/prompts/implement.md",
  ".gitmodules",
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  ".npmrc",
  "AGENTS.md",
  "src/AGENTS.override.md",
  ".codex/config.toml",
  ".codex/rules/factory.rules",
  "eslint.config.mjs",
  "tsconfig.json",
  "next.config.ts",
  "packages/example/package.json",
  "packages/example/pnpm-lock.yaml",
  "scripts/factory/check-boundaries.mjs",
  "scripts/run-factory.mjs",
]) {
  test(`rejects protected path ${path}`, () => {
    assert.throws(
      () => validateChangedPaths([path]),
      /protected factory paths/,
    );
  });
}

test("normalizes Windows separators before checking", () => {
  assert.throws(
    () => validateChangedPaths([".github\\workflows\\escape.yml"]),
    /protected factory paths/,
  );
});

for (const path of [
  "../../.github/workflows/escape.yml",
  "src/../.github/workflows/escape.yml",
  "/.github/workflows/escape.yml",
  "C:\\repo\\.github\\workflows\\escape.yml",
]) {
  test(`rejects non-repository path ${path}`, () => {
    assert.throws(
      () => validateChangedPaths([path]),
      /non-repository path/,
    );
  });
}

test("rejects candidates that change more than 50 files", () => {
  const paths = Array.from({ length: 51 }, (_, index) => `src/generated-${index}.ts`);
  assert.throws(() => validateChangedPaths(paths), /too many files/);
});

test("rejects a candidate file larger than 5 MB", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "factory-boundary-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const candidate = join(directory, "large.bin");
  writeFileSync(candidate, Buffer.alloc(5 * 1024 * 1024 + 1));

  assert.throws(
    () => validateCandidateSizes([candidate]),
    /exceeds 5 MB/,
  );
});

test("rejects candidate files larger than 10 MB in total", (context) => {
  const directory = mkdtempSync(join(tmpdir(), "factory-boundary-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const candidates = ["one.bin", "two.bin", "three.bin"].map((name) =>
    join(directory, name),
  );
  for (const candidate of candidates) {
    writeFileSync(candidate, Buffer.alloc(4 * 1024 * 1024));
  }

  assert.throws(
    () => validateCandidateSizes(candidates),
    /10 MB total limit/,
  );
});
