import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(
  new URL("./run-isolated-validation.sh", import.meta.url),
  "utf8",
);

test("validation phases use fresh immutable source snapshots", () => {
  assert.match(runner, /validation-source\.tar/);
  assert.match(
    runner,
    /for validation_command in "npm run lint" "npm test" "npm run build"/,
  );
  assert.match(runner, /--network none/);
  assert.match(runner, /--volume "\$archive:\/input\/source\.tar:ro"/);
  assert.match(runner, /node_modules:\/repo\/node_modules:ro/);
  assert.doesNotMatch(runner, /GITHUB_WORKSPACE:\/repo/);
});
