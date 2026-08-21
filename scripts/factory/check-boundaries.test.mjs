import assert from "node:assert/strict";
import test from "node:test";
import { validateChangedPaths } from "./check-boundaries.mjs";

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

test("rejects candidates that change more than 50 files", () => {
  const paths = Array.from({ length: 51 }, (_, index) => `src/generated-${index}.ts`);
  assert.throws(() => validateChangedPaths(paths), /too many files/);
});
