import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isAllowedApplicationUrl,
  validateScenario,
} from "./run-scenario.mjs";

test("keeps the checked-in editor smoke scenario executable", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/editor-smoke.scenario.json", import.meta.url),
      "utf8",
    ),
  );

  assert.doesNotThrow(() => validateScenario(fixture));
});

test("accepts a bounded browser acceptance scenario", () => {
  const scenario = {
    mode: "browser",
    summary: "Upload an image and expose the editor controls.",
    steps: [
      { operation: "goto", target: "/", value: null },
      {
        operation: "assert-attached",
        target: 'input[type="file"]',
        value: null,
      },
      {
        operation: "upload-image",
        target: 'input[type="file"]',
        value: null,
      },
      {
        operation: "assert-text",
        target: null,
        value: "Edit your image",
      },
      {
        operation: "fill",
        target: "#instructions",
        value: "Increase the contrast",
      },
      {
        operation: "assert-enabled",
        target: 'button[type="submit"]',
        value: null,
      },
    ],
  };

  assert.equal(validateScenario(scenario), scenario);
});

test("accepts an explicit non-applicable scenario", () => {
  assert.doesNotThrow(() =>
    validateScenario({
      mode: "not-applicable",
      summary: "The issue changes documentation only.",
      steps: [],
    }),
  );
});

test("rejects cross-origin navigation", () => {
  for (const target of ["//attacker.example", "/\\attacker.example/path"]) {
    assert.throws(
      () =>
        validateScenario({
          mode: "browser",
          summary: "Unsafe navigation",
          steps: [
            { operation: "goto", target, value: null },
            { operation: "assert-text", target: null, value: "stolen" },
          ],
        }),
      /application origin/,
    );
  }
});

test("rejects scenarios without observable assertions", () => {
  for (const step of [
    { operation: "click", target: "button", value: null },
    {
      operation: "assert-attached",
      target: 'input[type="file"]',
      value: null,
    },
  ]) {
    assert.throws(
      () =>
        validateScenario({
          mode: "browser",
          summary: "No user-visible outcome",
          steps: [
            { operation: "goto", target: "/", value: null },
            step,
          ],
        }),
      /observable outcome/,
    );
  }
});

test("rejects operation fields that do not match the safe DSL", () => {
  assert.throws(
    () =>
      validateScenario({
        mode: "browser",
        summary: "Invalid fill",
        steps: [
          { operation: "fill", target: "#instructions", value: null },
          { operation: "assert-text", target: null, value: "Editor" },
        ],
      }),
    /bounded single-line string/,
  );
});

test("rejects additional scenario and step fields", () => {
  assert.throws(
    () =>
      validateScenario({
        mode: "browser",
        summary: "Unexpected field",
        steps: [
          {
            operation: "assert-text",
            target: null,
            value: "Editor",
            script: "return true",
          },
        ],
      }),
    /unsupported fields/,
  );
});

test("allows only application-origin HTTP and WebSocket requests", () => {
  const baseUrl = "http://scenario-app:3000";

  assert.equal(
    isAllowedApplicationUrl("http://scenario-app:3000/_next/app.js", baseUrl),
    true,
  );
  assert.equal(
    isAllowedApplicationUrl("ws://scenario-app:3000/socket", baseUrl),
    true,
  );
  assert.equal(
    isAllowedApplicationUrl("https://attacker.example/popup", baseUrl),
    false,
  );
  assert.equal(
    isAllowedApplicationUrl("wss://attacker.example/socket", baseUrl),
    false,
  );
});
