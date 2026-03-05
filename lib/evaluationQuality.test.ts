import assert from "node:assert/strict";
import test from "node:test";

import { assessFinalEvaluationQuality } from "./evaluationQuality.ts";
import type { FinalEvaluation } from "./gradeFinalization.ts";
import type { Rubric } from "./schema.ts";

const rubric: Rubric = {
  criteria: [
    { name: "Thesis", max_score: 10, description: "clear thesis" },
    { name: "Evidence", max_score: 10, description: "supporting evidence" },
  ],
};

const validStrictEvaluation: FinalEvaluation = {
  title: "Evaluation Summary",
  access_tier: "pro",
  overall_range: [75, 82],
  summary: "Concise summary.",
  top_improvements: ["Clarify thesis", "Add stronger quotes", "Tighten conclusion"],
  criteria: [
    {
      name: "Thesis",
      max_score: 10,
      score: 8,
      rationale: "Clear but slightly broad.",
      estimated_range: [7, 8],
      feedback: "Narrow the thesis to one precise claim.",
      evidence: ["The thesis is broad."],
    },
    {
      name: "Evidence",
      max_score: 10,
      score: 7,
      rationale: "Support exists but analysis is shallow.",
      estimated_range: [6, 7],
      feedback: "Connect quotes to argument with deeper analysis.",
      evidence: ["Example quote one", "Example quote two"],
    },
  ],
};

test("strict evaluation passes guardrail when evidence requirements are met", () => {
  const result = assessFinalEvaluationQuality(rubric, validStrictEvaluation, "strict");
  assert.equal(result.passed, true);
  assert.deepEqual(result.hardFailures, []);
});

test("strict evaluation fails guardrail when evidence is missing", () => {
  const broken: FinalEvaluation = {
    ...validStrictEvaluation,
    criteria: [
      {
        ...validStrictEvaluation.criteria[0],
        evidence: undefined,
      },
      validStrictEvaluation.criteria[1],
    ],
  };

  const result = assessFinalEvaluationQuality(rubric, broken, "strict");
  assert.equal(result.passed, false);
  assert.ok(result.hardFailures.includes("strict_evidence_missing"));
});
