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
