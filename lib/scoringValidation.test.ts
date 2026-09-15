import assert from "node:assert/strict";
import test from "node:test";
import { validateScoringDataset } from "./scoringValidation.ts";

// Synthetic unit fixture tests the arithmetic, not AI accuracy or calibration.
const sample = {
  id: "unit-fixture", human_grade_reference: "synthetic-test-only", mode: "standard",
  rubric: { criteria: ["A", "B"].map(name => ({ name, max_score: 50, description: "Test" })) },
  human_score: 75,
  evaluation: { summary: "Synthetic test.", top_improvements: ["A", "B", "C"],
    criteria_scores: ["A", "B"].map(name => ({ name, score: 38, rationale: "Test", feedback: "Test", estimated_range: [35, 40], evidence: ["Test"] })) },
};
const dataset = { data_kind: "human_graded_holdout", source: "unit test only", model_version: "test", prompt_version: "test", samples: [sample, { ...sample, mode: "strict" }] };

test("audit reports midpoint error and range coverage separately by mode", () => {
  const result = validateScoringDataset(dataset);
  assert.equal(result.calibration_status, "not_established");
  assert.deepEqual(result.by_mode.standard.current, { sample_count: 1, midpoint_mae: 0, midpoint_bias: 0, observed_range_coverage: 1, mean_range_width: 10 });
  assert.equal(result.by_mode.standard.offset_only?.midpoint_bias, 4);
  assert.equal(result.by_mode.strict.offset_only?.midpoint_bias, -3);
});

test("audit rejects missing provenance, empty datasets, duplicate modes and invalid teacher scores", () => {
  for (const input of [{ ...dataset, data_kind: "synthetic" }, { ...dataset, source: "" }, { ...dataset, samples: [] },
    { ...dataset, samples: [sample, sample] }, { ...dataset, samples: [{ ...sample, human_score: 101 }] }]) {
    assert.throws(() => validateScoringDataset(input));
  }
});
