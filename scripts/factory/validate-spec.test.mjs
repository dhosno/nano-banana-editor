import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ARRAY_FIELDS,
  REQUIRED_KEYS,
  STRING_FIELDS,
  validateSpec,
} from "./validate-spec.mjs";

const schema = JSON.parse(
  readFileSync(
    new URL("../../.github/codex/schemas/spec.schema.json", import.meta.url),
    "utf8",
  ),
);

function specifiedSpec(overrides = {}) {
  return {
    readiness: "specified",
    title: "Add a clear-instructions button",
    intent: "Let users reset the edit instructions field with one click.",
    in_scope: ["A button that clears the instructions input"],
    out_of_scope: ["Changing how instructions are submitted"],
    acceptance_criteria: [
      "A visible button clears the instructions field when clicked",
      "The button is disabled while there is no instruction text",
    ],
    implementation_plan: [
      "Add a clear handler in src/app/page.tsx",
      "Disable it via hasInstructions from src/lib/instructions.ts",
    ],
    affected_areas: ["src/app/page.tsx", "src/lib/instructions.ts"],
    test_plan: ["Unit test hasInstructions", "Browser scenario clicks the button"],
    references: ["src/app/page.tsx", "src/lib/instructions.ts", "README.md"],
    open_questions: [],
    ...overrides,
  };
}

function needsInfoSpec(overrides = {}) {
  return {
    readiness: "needs-info",
    title: "Improve the editor",
    intent: "The request does not say which editor behavior should change.",
    in_scope: [],
    out_of_scope: [],
    acceptance_criteria: [],
    implementation_plan: [],
    affected_areas: [],
    test_plan: [],
    references: ["README.md"],
    open_questions: ["Which specific behavior should change, and how?"],
    ...overrides,
  };
}

test("accepts a well-formed specified spec", () => {
  const spec = specifiedSpec();
  assert.equal(validateSpec(spec), spec);
});

test("accepts a well-formed needs-info spec", () => {
  assert.doesNotThrow(() => validateSpec(needsInfoSpec()));
});

test("rejects unknown or missing fields", () => {
  assert.throws(
    () => validateSpec({ ...specifiedSpec(), extra: "nope" }),
    /unsupported or missing fields/,
  );
  const { open_questions, ...withoutKey } = specifiedSpec();
  void open_questions;
  assert.throws(() => validateSpec(withoutKey), /unsupported or missing fields/);
});

test("rejects an unsupported readiness value", () => {
  assert.throws(
    () => validateSpec(specifiedSpec({ readiness: "maybe" })),
    /readiness is unsupported/,
  );
});

test("rejects multi-line or empty bounded strings", () => {
  assert.throws(
    () => validateSpec(specifiedSpec({ title: "line one\nline two" })),
    /title must be a bounded single-line string/,
  );
  assert.throws(
    () => validateSpec(specifiedSpec({ intent: "" })),
    /intent must be a bounded single-line string/,
  );
});

test("enforces array item caps", () => {
  assert.throws(
    () =>
      validateSpec(
        specifiedSpec({
          acceptance_criteria: Array.from({ length: 21 }, (_, i) => `criterion ${i}`),
        }),
      ),
    /acceptance_criteria contains more than 20 items/,
  );
});

test("a specified spec must carry acceptance criteria and a plan and no open questions", () => {
  assert.throws(
    () => validateSpec(specifiedSpec({ acceptance_criteria: [] })),
    /at least one acceptance criterion/,
  );
  assert.throws(
    () => validateSpec(specifiedSpec({ implementation_plan: [] })),
    /must list an implementation plan/,
  );
  assert.throws(
    () => validateSpec(specifiedSpec({ open_questions: ["why?"] })),
    /cannot carry open questions/,
  );
});

test("a needs-info spec must carry questions and no acceptance criteria", () => {
  assert.throws(
    () => validateSpec(needsInfoSpec({ open_questions: [] })),
    /at least one open question/,
  );
  assert.throws(
    () => validateSpec(needsInfoSpec({ acceptance_criteria: ["something"] })),
    /cannot assert acceptance criteria/,
  );
});

test("rejects non-object candidates", () => {
  assert.throws(() => validateSpec(null), /Spec must be an object/);
  assert.throws(() => validateSpec([]), /Spec must be an object/);
});

test("the trusted validator and the Codex output schema cannot drift apart", () => {
  // Codex is constrained by spec.schema.json; every downstream stage trusts
  // validate-spec.mjs. If their contracts diverge, a schema-valid spec could be
  // rejected downstream (or, worse, an under-constrained one slip through). Bind
  // them so a change to one must change the other.
  assert.deepEqual(
    [...schema.required].sort(),
    [...REQUIRED_KEYS].sort(),
  );
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.readiness.enum, ["specified", "needs-info"]);

  for (const [field, maxLength] of Object.entries(STRING_FIELDS)) {
    assert.equal(
      schema.properties[field].maxLength,
      maxLength,
      `${field} maxLength must match`,
    );
  }

  for (const [field, bounds] of Object.entries(ARRAY_FIELDS)) {
    assert.equal(
      schema.properties[field].maxItems,
      bounds.maxItems,
      `${field} maxItems must match`,
    );
    assert.equal(
      schema.properties[field].items.maxLength,
      bounds.maxLength,
      `${field} item maxLength must match`,
    );
  }

  // Every property the schema declares must be one the validator knows about.
  const known = new Set([...REQUIRED_KEYS]);
  for (const property of Object.keys(schema.properties)) {
    assert.ok(known.has(property), `schema property ${property} is unvalidated`);
  }
});
