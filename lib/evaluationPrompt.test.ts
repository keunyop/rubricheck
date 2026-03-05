import assert from "node:assert/strict";
import test from "node:test";

import { buildEvaluationPrompt } from "./evaluationPrompt.ts";
import type { Rubric } from "./schema.ts";

const rubric: Rubric = {
  criteria: [
    {
      name: "Thesis",
      max_score: 10,
      description: "Clarity and focus of thesis.",
    },
    {
      name: "Evidence",
      max_score: 10,
      description: "Use of evidence and analysis.",
    },
  ],
};

test("standard prompt excludes strict-only instructions", () => {
  const prompt = buildEvaluationPrompt(rubric, "Sample assignment", "standard", "diagnostic");

  assert.ok(prompt.includes("- evidence is optional in standard mode; omit it if not useful."));
  assert.ok(!prompt.includes("Be conservative. Do not give benefit of doubt"));
  assert.ok(!prompt.includes("evidence is required and must contain 1-2 items per criterion."));
  assert.ok(!prompt.includes("<= 60% of criterion max_score"));
});

test("strict prompt includes strict-only instructions", () => {
  const prompt = buildEvaluationPrompt(rubric, "Sample assignment", "strict", "diagnostic");

  assert.ok(prompt.includes("Be conservative. Do not give benefit of doubt"));
  assert.ok(prompt.includes("evidence is required and must contain 1-2 items per criterion."));
  assert.ok(prompt.includes("<= 60% of criterion max_score"));
});
