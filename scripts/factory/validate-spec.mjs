import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Trusted re-validation of a Codex-produced specification. The Codex action
// already constrains output to spec.schema.json, but every stage that consumes
// the spec re-checks it here so a malformed or oversized artifact can never
// reach the implementation, evaluation, or scenario stages. Kept as a pure
// function so it is unit-testable without the network or GitHub.

export const REQUIRED_KEYS = [
  "readiness",
  "title",
  "intent",
  "in_scope",
  "out_of_scope",
  "acceptance_criteria",
  "implementation_plan",
  "affected_areas",
  "test_plan",
  "references",
  "open_questions",
];

export const STRING_FIELDS = {
  title: 200,
  intent: 2000,
};

export const ARRAY_FIELDS = {
  in_scope: { maxItems: 20, maxLength: 500 },
  out_of_scope: { maxItems: 20, maxLength: 500 },
  acceptance_criteria: { maxItems: 20, maxLength: 500 },
  implementation_plan: { maxItems: 20, maxLength: 500 },
  affected_areas: { maxItems: 30, maxLength: 300 },
  test_plan: { maxItems: 20, maxLength: 500 },
  references: { maxItems: 30, maxLength: 300 },
  open_questions: { maxItems: 20, maxLength: 500 },
};

function requireBoundedString(value, field, maxLength) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    /[\0\r\n]/.test(value)
  ) {
    throw new Error(`${field} must be a bounded single-line string`);
  }
}

function requireBoundedStringArray(value, field, { maxItems, maxLength }) {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  if (value.length > maxItems) {
    throw new Error(`${field} contains more than ${maxItems} items`);
  }
  value.forEach((item, index) =>
    requireBoundedString(item, `${field}[${index}]`, maxLength),
  );
}

export function validateSpec(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Spec must be an object");
  }

  const keys = Object.keys(candidate).sort();
  if (keys.join(",") !== [...REQUIRED_KEYS].sort().join(",")) {
    throw new Error("Spec contains unsupported or missing fields");
  }

  if (!["specified", "needs-info"].includes(candidate.readiness)) {
    throw new Error("Spec readiness is unsupported");
  }

  for (const [field, maxLength] of Object.entries(STRING_FIELDS)) {
    requireBoundedString(candidate[field], field, maxLength);
  }

  for (const [field, bounds] of Object.entries(ARRAY_FIELDS)) {
    requireBoundedStringArray(candidate[field], field, bounds);
  }

  if (candidate.readiness === "specified") {
    if (candidate.acceptance_criteria.length === 0) {
      throw new Error("A specified spec must list at least one acceptance criterion");
    }
    if (candidate.implementation_plan.length === 0) {
      throw new Error("A specified spec must list an implementation plan");
    }
    if (candidate.open_questions.length !== 0) {
      throw new Error("A specified spec cannot carry open questions");
    }
  } else {
    if (candidate.open_questions.length === 0) {
      throw new Error("A needs-info spec must list at least one open question");
    }
    if (candidate.acceptance_criteria.length !== 0) {
      throw new Error("A needs-info spec cannot assert acceptance criteria");
    }
  }

  return candidate;
}

function readSpec(path) {
  return validateSpec(JSON.parse(readFileSync(path, "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "--validate") {
      const spec = readSpec(process.argv[3]);
      console.log(`Specification is valid (readiness: ${spec.readiness}).`);
    } else {
      throw new Error("Usage: node validate-spec.mjs --validate <path>");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
