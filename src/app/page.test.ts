import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("describes iterative Gemini image editing in the landing hero", () => {
  const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  assert.match(
    pageSource,
    /<p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">\s*Upload a photo and refine it step by step with conversational Gemini image edits\.\s*<\/p>/,
  );
});
