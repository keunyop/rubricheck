import assert from "node:assert/strict";
import test from "node:test";
import { formatOverallScoreDisplay, explainScoreCalculation } from "./scorePresentation.ts";

test("display keeps both endpoints even for a narrow estimate", () => {
  for (const [range, expected] of [[[70, 71], "70~71"], [[70, 75], "70~75"], [[70, 80], "70~80"], [[0, 100], "0~100"], [[80, 80], "80"]] as const) {
    assert.equal(formatOverallScoreDisplay([...range]), expected);
  }
});

test("legacy results are not described as using the new calculation", () => {
  assert.match(explainScoreCalculation({ overall_range: [74, 84] }), /earlier scoring method/);
  assert.match(explainScoreCalculation({ overall_range: [70, 80], score_calculation: {
    version: "rubric-sum-v2", range_kind: "uncalibrated_estimate", grading_mode: "strict",
    rubric_total: 20, criteria_range_sum: [14, 16], mode_adjustment: 0,
  } }), /rubric total 20/);
});

test("incomplete saved calculation metadata does not crash the result view", () => {
  const result = JSON.parse('{"overall_range":[70,80],"score_calculation":{"version":"rubric-sum-v2"}}');
  assert.match(explainScoreCalculation(result), /unavailable/);
});

test("adjusted results explain the separate signed adjustment and retain localized labels", () => {
  const result = { overall_range: [68, 88] as [number, number], score_calculation: {
    version: "rubric-sum-v3" as const, range_kind: "uncalibrated_estimate" as const, grading_mode: "standard" as const,
    rubric_total: 100, criteria_range_sum: [70, 90] as [number, number], mode_adjustment: 0 as const, rubric_adjustment: -2,
  } };
  assert.match(explainScoreCalculation(result), /adjustments -2.*base rubric total 100/);
  assert.match(explainScoreCalculation(result, "ko"), /감점·가산점 -2/);
  assert.match(explainScoreCalculation({ ...result, score_calculation: { ...result.score_calculation, rubric_adjustment: undefined } }), /unavailable/);
});
