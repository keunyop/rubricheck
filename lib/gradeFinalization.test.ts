import assert from "node:assert/strict";
import test from "node:test";

import { buildFinalEvaluation, restrictEvaluationFeedback } from "./gradeFinalization.ts";
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

test("standard sums criterion ranges without a mode adjustment or evidence requirement", () => {
  const result = buildFinalEvaluation(rubric, standardEvaluation, "standard", "pro");

  assert.equal(result.access_tier, "pro");
  assert.deepEqual(result.overall_range, [75, 85]);
  assert.equal(result.criteria.every((criterion) => criterion.evidence === undefined), true);
});

test("strict requires evidence but adds no overall penalty", () => {
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
  assert.deepEqual(result.overall_range, [75, 85]);
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

test("wide model estimates remain wide rather than claiming artificial precision", () => {
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
  assert.deepEqual(result.overall_range, [0, 100]);
  assert.deepEqual(result.criteria.map(c => c.estimated_range), [[0, 10], [0, 10]]);
});

test("synthetic 70-80 sums stay 70-80 in both modes and expose calculation provenance", () => {
  const syntheticRubric: Rubric = { criteria: rubric.criteria.map(c => ({ ...c, max_score: 50 })) };
  const evaluation: Evaluation = { ...standardEvaluation, criteria_scores: standardEvaluation.criteria_scores.map(c => ({ ...c, score: 38, estimated_range: [35, 40], evidence: ["Synthetic only"] })) };
  for (const mode of ["standard", "strict"] as const) {
    const result = buildFinalEvaluation(syntheticRubric, evaluation, mode, "pro");
    assert.deepEqual(result.overall_range, [70, 80]);
    assert.deepEqual(result.score_calculation, {
      version: "rubric-sum-v2", range_kind: "uncalibrated_estimate", grading_mode: mode,
      rubric_total: 100, criteria_range_sum: [70, 80], mode_adjustment: 0,
    });
  }
});

test("unequal weights and non-100 totals scale endpoints once and round to whole points", () => {
  const weighted: Rubric = { criteria: [{ ...rubric.criteria[0], max_score: 7 }, { ...rubric.criteria[1], max_score: 23 }] };
  const evaluation: Evaluation = { ...standardEvaluation, criteria_scores: [
    { ...standardEvaluation.criteria_scores[0], estimated_range: [4, 6] },
    { ...standardEvaluation.criteria_scores[1], estimated_range: [17, 19] },
  ] };
  const result = buildFinalEvaluation(weighted, evaluation, "standard", "free");
  assert.deepEqual(result.overall_range, [70, 83]);
  assert.deepEqual(result.score_calculation?.criteria_range_sum, [21, 25]);
  assert.equal(result.score_calculation?.rubric_total, 30);
});

test("out-of-bounds ranges stay within rubric limits without a mode shift", () => {
  const evaluation: Evaluation = { ...standardEvaluation, criteria_scores: standardEvaluation.criteria_scores.map(c => ({ ...c, estimated_range: [-10, 40] })) };
  const result = buildFinalEvaluation(rubric, evaluation, "standard", "free");
  assert.deepEqual(result.overall_range, [0, 100]);
  assert.deepEqual(result.criteria.map(c => c.estimated_range), [[0, 10], [0, 10]]);
});

test("server output and legacy response filtering enforce the same tier boundaries", () => {
  const evaluation: Evaluation = { ...standardEvaluation, criteria_scores: standardEvaluation.criteria_scores.map(c => ({ ...c, detailed_breakdown: "Paid detail", example_revisions: ["Pro rewrite"] })) };
  for (const tier of ["free", "topup", "pro"] as const) {
    const result = buildFinalEvaluation(rubric, evaluation, "standard", tier);
    assert.equal(result.top_improvements.length, tier === "free" ? 1 : 3);
    const legacy = { ...buildFinalEvaluation(rubric, evaluation, "standard", "pro"), access_tier: tier };
    const restricted = restrictEvaluationFeedback(legacy);
    assert.deepEqual(restricted.top_improvements, result.top_improvements);
    assert.equal(restricted.criteria[0].detailed_breakdown, tier === "free" ? undefined : "Paid detail");
    assert.deepEqual(restricted.criteria[0].example_revisions, tier === "pro" ? ["Pro rewrite"] : undefined);
    assert.equal(legacy.top_improvements.length, 3);
    assert.deepEqual(restricted.overall_range, legacy.overall_range);
  }
});
