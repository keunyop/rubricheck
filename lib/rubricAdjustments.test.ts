import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFinalEvaluation } from "./gradeFinalization.ts";
import { buildEvaluationPrompt } from "./evaluationPrompt.ts";
import { normalizeModelEvaluation } from "./evaluationNormalization.ts";
import { EvaluationSchema, RubricSchema, type Evaluation, type Rubric } from "./schema.ts";
import { structureRubric } from "./rubricStructuring.ts";

const rubric: Rubric = {
  criteria: [{ name: "Argument", max_score: 60, description: "Quality of reasoning" }, { name: "Evidence", max_score: 40, description: "Support claims" }],
  adjustments: [
    { name: "Length", kind: "deduction", max_points: 5, description: "Deduct 5 for an essay under the specified word limit." },
    { name: "Bonus", kind: "bonus", max_points: 3, description: "Award up to 3 for a separate substantive community paragraph." },
  ],
};
const evaluation: Evaluation = {
  summary: "Clear reasoning with some gaps.", top_improvements: ["Explain the evidence.", "Clarify the scope.", "Expand the conclusion."],
  criteria_scores: rubric.criteria.map(c => ({ name: c.name, score: c.max_score - 10, estimated_range: [c.max_score - 15, c.max_score - 5], rationale: "Clear", feedback: "Develop the explanation", evidence: ["Synthetic quote"] })),
  score_adjustments: [{ name: "Length", points: 5, rationale: "Below the word limit." }, { name: "Bonus", points: 3, rationale: "Separate community paragraph supplied." }],
};

test("rubric deductions and bonuses never inflate the denominator and apply exactly once", () => {
  for (const mode of ["standard", "strict"] as const) {
    const result = buildFinalEvaluation(rubric, evaluation, mode, "free");
    assert.equal(result.score_calculation?.rubric_total, 100);
    assert.deepEqual(result.score_calculation?.criteria_range_sum, [70, 90]);
    assert.equal(result.score_calculation?.rubric_adjustment, -2);
    assert.deepEqual(result.overall_range, [68, 88]);
    assert.equal(result.score_calculation?.version, "rubric-sum-v3");
    assert.equal(result.criteria.length, 2);
    assert.deepEqual(result.score_adjustments?.map(a => [a.kind, a.points]), [["deduction", 5], ["bonus", 3]]);
  }
});

test("missing, extra, negative, over-limit or duplicated adjustments cannot produce grades", () => {
  for (const scores of [undefined, [], [evaluation.score_adjustments![0]],
    [...evaluation.score_adjustments!, evaluation.score_adjustments![0]],
    [evaluation.score_adjustments![0], evaluation.score_adjustments![0]],
    ...[-5, 6, NaN, Infinity].map(points => [{ ...evaluation.score_adjustments![0], points }, evaluation.score_adjustments![1]]),
  ]) assert.throws(() => buildFinalEvaluation(rubric, { ...evaluation, score_adjustments: scores }, "standard", "pro"), /EVALUATION_FAILED/);
  assert.throws(() => buildFinalEvaluation({ criteria: rubric.criteria }, evaluation, "standard", "pro"), /EVALUATION_FAILED/);
});

test("optional adjustments at zero preserve the base range; final percentages remain bounded", () => {
  const zero = { ...evaluation, score_adjustments: evaluation.score_adjustments!.map(a => ({ ...a, points: 0 })) };
  assert.deepEqual(buildFinalEvaluation(rubric, zero, "standard", "pro").overall_range, [70, 90]);
  const maximum = { ...evaluation, criteria_scores: evaluation.criteria_scores.map((c, i) => ({ ...c, estimated_range: [rubric.criteria[i].max_score, rubric.criteria[i].max_score] as [number, number] })), score_adjustments: [{ ...evaluation.score_adjustments![0], points: 0 }, evaluation.score_adjustments![1]] };
  assert.deepEqual(buildFinalEvaluation(rubric, maximum, "standard", "pro").overall_range, [100, 100]);
  const minimum = { ...evaluation, criteria_scores: evaluation.criteria_scores.map(c => ({ ...c, score: 0, estimated_range: [0, 0] as [number, number] })), score_adjustments: [evaluation.score_adjustments![0], { ...evaluation.score_adjustments![1], points: 0 }] };
  assert.deepEqual(buildFinalEvaluation(rubric, minimum, "standard", "pro").overall_range, [0, 0]);
});

test("extraction and evaluation preserve separate adjustment rules and proof requirements", async () => {
  let prompt = "";
  assert.deepEqual(await structureRubric("Synthetic 100-point rubric with a deduction and bonus", { cacheRedisOverride: null, modelCaller: async p => { prompt = p; return rubric; } }), rubric);
  assert.match(prompt, /must never increase the base rubric total/);
  assert.match(prompt, /only its base scoring categories/);
  const evaluationPrompt = buildEvaluationPrompt(rubric, "Synthetic assignment", "standard");
  assert.match(evaluationPrompt, /score_adjustments/);
  assert.match(evaluationPrompt, /that would double count/);
  assert.match(evaluationPrompt, /use zero when unverified/);
  assert.ok(RubricSchema.safeParse(rubric).success);
  assert.equal(RubricSchema.safeParse({ ...rubric, total_score: 100 }).success, true);
  assert.equal(RubricSchema.safeParse({ ...rubric, total_score: 100, criteria: [...rubric.criteria, { name: "Incorrect penalty criterion", max_score: 5, description: "Not a base category" }] }).success, false);
  assert.ok(EvaluationSchema.safeParse(normalizeModelEvaluation(evaluation)).success);
  assert.equal(EvaluationSchema.safeParse({ ...evaluation, score_adjustments: [{ name: "Length", points: -5, rationale: "Wrong signed output" }] }).success, false);
  const withoutAdjustments = { criteria: rubric.criteria };
  assert.deepEqual(await structureRubric("No adjustments", { cacheRedisOverride: null, modelCaller: async () => ({ ...withoutAdjustments, adjustments: [] }) }), withoutAdjustments);
});
