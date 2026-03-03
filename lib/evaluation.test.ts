import assert from "node:assert/strict";
import test from "node:test";

import { normalizeModelEvaluation } from "./evaluationNormalization.ts";

test("normalizeModelEvaluation drops empty optional arrays from criteria scores", () => {
  const normalized = normalizeModelEvaluation({
    summary: "Clear direction overall.",
    top_improvements: ["Tighten the thesis.", "Add support.", "Polish transitions."],
    criteria_scores: [
      {
        name: "Thesis",
        score: 8,
        rationale: "Mostly clear.",
        estimated_range: [7, 8],
        feedback: "Clarify the scope a little more.",
        evidence: [],
        example_revisions: [],
      },
      {
        name: "Evidence",
        score: 7,
        rationale: "Some support is thin.",
        estimated_range: [6, 7],
        feedback: "Add one stronger quotation.",
        detailed_breakdown: "   ",
      },
    ],
  }) as {
    criteria_scores: Array<Record<string, unknown>>;
  };

  assert.ok(Array.isArray(normalized.criteria_scores));
  assert.deepEqual(normalized.criteria_scores[0].evidence, undefined);
  assert.deepEqual(normalized.criteria_scores[0].example_revisions, undefined);
  assert.deepEqual(normalized.criteria_scores[1].detailed_breakdown, undefined);
});
