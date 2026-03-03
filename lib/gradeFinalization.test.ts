import assert from "node:assert/strict";
import test from "node:test";

import { buildFinalEvaluation } from "./gradeFinalization.ts";
import type { Evaluation, Rubric } from "./schema.ts";

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

const standardEvaluation: Evaluation = {
  summary: "Clear core idea with uneven support.",
  top_improvements: ["Clarify thesis scope.", "Strengthen support.", "Tighten transitions."],
  criteria_scores: [
    {
      name: "Thesis",
      score: 8,
      rationale: "Thesis is clear but slightly broad.",
      estimated_range: [8, 9],
      feedback: "Thesis is clear but needs tighter scope control.",
    },
    {
      name: "Evidence",
      score: 7,
      rationale: "Claims are present but support is limited.",
      estimated_range: [7, 8],
      feedback: "Support is present but key claims need stronger backing.",
    },
  ],
};

test("standard scoring path does not apply strict penalty and does not require evidence", () => {
  const result = buildFinalEvaluation(rubric, standardEvaluation, "standard", "pro");

  assert.equal(result.access_tier, "pro");
  assert.deepEqual(result.overall_range, [79, 89]);
  assert.equal(result.criteria.every((criterion) => criterion.evidence === undefined), true);
});

test("strict scoring path requires evidence and applies strict penalty", () => {
  assert.throws(
    () => buildFinalEvaluation(rubric, standardEvaluation, "strict", "pro"),
    /EVALUATION_FAILED/,
  );

  const strictEvaluation: Evaluation = {
    ...standardEvaluation,
    criteria_scores: standardEvaluation.criteria_scores.map((criterion) => ({
      ...criterion,
      evidence: ["\"quoted snippet\""],
    })),
  };

  const result = buildFinalEvaluation(rubric, strictEvaluation, "strict", "pro");
  assert.deepEqual(result.overall_range, [72, 82]);
});

test("free tier keeps base feedback but marks detailed breakdown as pro-only", () => {
  const verboseEvaluation: Evaluation = {
    ...standardEvaluation,
    criteria_scores: standardEvaluation.criteria_scores.map((criterion) => ({
      ...criterion,
      feedback: "Add one or two concrete examples for stronger support in this section.",
    })),
  };

  const result = buildFinalEvaluation(rubric, verboseEvaluation, "standard", "free");

  for (const criterion of result.criteria) {
    assert.ok(typeof criterion.feedback === "string");
    assert.equal(criterion.feedback, "Add one or two concrete examples for stronger support in this section.");
    assert.equal(criterion.detailed_breakdown_locked, true);
    assert.equal(criterion.example_revisions, undefined);
  }
});

test("top-up tier includes detailed breakdown but keeps rewrite suggestions locked", () => {
  const detailedEvaluation: Evaluation = {
    ...standardEvaluation,
    criteria_scores: standardEvaluation.criteria_scores.map((criterion) => ({
      ...criterion,
      detailed_breakdown: "Pinpoint the weak evidence, then add one stronger quotation and analysis.",
      example_revisions: ["Insert a stronger quotation.", "Explain how that quotation proves the claim."],
    })),
  };

  const result = buildFinalEvaluation(rubric, detailedEvaluation, "standard", "topup");

  assert.equal(result.access_tier, "topup");
  for (const criterion of result.criteria) {
    assert.equal(typeof criterion.detailed_breakdown, "string");
    assert.equal(criterion.example_revisions, undefined);
    assert.notEqual(criterion.detailed_breakdown_locked, true);
  }
});

test("overall range width is capped to at most 15 points", () => {
  const wideEvaluation: Evaluation = {
    ...standardEvaluation,
    criteria_scores: [
      {
        name: "Thesis",
        score: 5,
        rationale: "Mixed alignment.",
        estimated_range: [0, 10],
        feedback: "Needs stronger criterion alignment.",
      },
      {
        name: "Evidence",
        score: 5,
        rationale: "Mixed support quality.",
        estimated_range: [0, 10],
        feedback: "Support needs clearer backing.",
      },
    ],
  };

  const result = buildFinalEvaluation(rubric, wideEvaluation, "standard", "pro");
  const width = result.overall_range[1] - result.overall_range[0];
  assert.ok(width <= 15);
});
