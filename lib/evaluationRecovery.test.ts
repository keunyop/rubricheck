import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GradingMode } from "./schema.ts";

const rubric = { criteria: [{ name: "Evidence", max_score: 10, description: "Use sources; deduct 5 for missing citations." }] };
const valid = {
  summary: "The argument needs support.",
  criteria_scores: [{ name: "Evidence", score: 3, estimated_range: [2, 4], rationale: "Citation deduction applied.", feedback: "Cite the source.", evidence: ["A synthetic quotation."] }],
  top_improvements: ["Cite sources.", "Develop the argument.", "Explain the conclusion."],
};
const negative = { ...valid, criteria_scores: [{ ...valid.criteria_scores[0], score: -5, estimated_range: [-5, -3] }] };
let responses: unknown[] = [];
const prompts: string[] = [];
mock.module("./openai.ts", { namedExports: {
  callEvaluationModel: async (prompt: string) => {
    prompts.push(prompt);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  },
} });
const { evaluateAssignment } = await import("./evaluation.ts");

test("evaluation recovers invalid model output without inventing scores or unbounded retries", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  t.mock.method(console, "warn", (...args: unknown[]) => logs.push(args));
  for (const mode of ["standard", "strict"] as GradingMode[]) {
    await t.test(mode + " retries a negative deduction score and returns only the valid re-evaluation", async () => {
      responses = [negative, valid]; prompts.length = 0;
      const result = await evaluateAssignment(rubric, "Synthetic assignment", mode);
      assert.equal(result.criteria_scores[0].score, 3);
      assert.equal(prompts.length, 2);
      assert.match(prompts[1], /criteria_scores\.0\.score/);
      assert.match(prompts[1], /nonnegative/);
    });
  }
  await t.test("valid grading makes exactly one model call", async () => {
    responses = [valid]; prompts.length = 0;
    assert.deepEqual(await evaluateAssignment(rubric, "Synthetic assignment"), valid);
    assert.equal(prompts.length, 1);
  });
  await t.test("missing or over-limit adjustment output is regenerated without accepting a partial grade", async () => {
    const withRule = { ...rubric, adjustments: [{ name: "Missing citation", kind: "deduction" as const, max_points: 5, description: "Deduct 5 if the citation is missing." }] };
    const correct = { ...valid, score_adjustments: [{ name: "Missing citation", points: 5, rationale: "No citation." }] };
    for (const invalid of [valid, { ...correct, score_adjustments: [{ ...correct.score_adjustments[0], points: 10 }] }]) {
      responses = [invalid, correct]; prompts.length = 0;
      assert.deepEqual(await evaluateAssignment(withRule, "Synthetic assignment"), correct);
      assert.equal(prompts.length, 2);
      assert.match(prompts[1], /score_adjustments/);
    }
  });
  await t.test("persistent invalid output is rejected after one recovery", async () => {
    responses = [negative, negative]; prompts.length = 0;
    await assert.rejects(evaluateAssignment(rubric, "Synthetic assignment"), /EVALUATION_FAILED/);
    assert.equal(prompts.length, 2);
  });
  await t.test("invalid JSON can recover; provider failures and timeouts are not retried", async () => {
    responses = [new Error("MODEL_JSON_PARSE_FAILED"), valid]; prompts.length = 0;
    assert.deepEqual(await evaluateAssignment(rubric, "Synthetic assignment"), valid);
    assert.equal(prompts.length, 2);
    for (const error of [new Error("OPENAI_TIMEOUT"), Object.assign(new Error("private-provider-body secret-key"), { status: 429 })]) {
      responses = [error]; prompts.length = 0;
      await assert.rejects(evaluateAssignment(rubric, "Synthetic assignment"), /OPENAI_TIMEOUT|EVALUATION_FAILED/);
      assert.equal(prompts.length, 1);
    }
    assert.doesNotMatch(JSON.stringify(logs), /private-provider-body|secret-key|Synthetic assignment/);
  });
});
