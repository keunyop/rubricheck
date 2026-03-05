import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvaluationModelOptions,
  buildStructureModelOptions,
  resolveEvaluationOptimizationVariant,
} from "./modelOptimization.ts";
import type { Rubric } from "./schema.ts";

const rubric: Rubric = {
  criteria: [
    { name: "Thesis", max_score: 10, description: "clear thesis" },
    { name: "Evidence", max_score: 10, description: "supporting evidence" },
  ],
};

test("rollout percent 0 defaults to control", () => {
  const previous = process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT;
  process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT = "0";
  delete process.env.EVAL_OPTIMIZATION_FORCE_VARIANT;

  const result = resolveEvaluationOptimizationVariant("req_123");
  assert.equal(result.requestedVariant, "control");

  if (previous === undefined) {
    delete process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT;
  } else {
    process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT = previous;
  }
});

test("force variant env takes priority", () => {
  const previousPercent = process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT;
  const previousForce = process.env.EVAL_OPTIMIZATION_FORCE_VARIANT;
  process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT = "0";
  process.env.EVAL_OPTIMIZATION_FORCE_VARIANT = "optimized";

  const result = resolveEvaluationOptimizationVariant("req_123");
  assert.equal(result.requestedVariant, "optimized");

  if (previousPercent === undefined) {
    delete process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT;
  } else {
    process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT = previousPercent;
  }
  if (previousForce === undefined) {
    delete process.env.EVAL_OPTIMIZATION_FORCE_VARIANT;
  } else {
    process.env.EVAL_OPTIMIZATION_FORCE_VARIANT = previousForce;
  }
});

test("header override takes highest priority", () => {
  const previousForce = process.env.EVAL_OPTIMIZATION_FORCE_VARIANT;
  process.env.EVAL_OPTIMIZATION_FORCE_VARIANT = "optimized";

  const result = resolveEvaluationOptimizationVariant("req_123", {
    headerOverride: "control",
  });
  assert.equal(result.requestedVariant, "control");

  if (previousForce === undefined) {
    delete process.env.EVAL_OPTIMIZATION_FORCE_VARIANT;
  } else {
    process.env.EVAL_OPTIMIZATION_FORCE_VARIANT = previousForce;
  }
});

test("optimized options include schema and output token budget", () => {
  const structureOptions = buildStructureModelOptions("optimized", "criterion one criterion two");
  const evaluationOptions = buildEvaluationModelOptions("optimized", rubric, "strict", "detailed");

  assert.ok(structureOptions);
  assert.ok(evaluationOptions);
  assert.equal(typeof structureOptions?.maxOutputTokens, "number");
  assert.equal(typeof evaluationOptions?.maxOutputTokens, "number");
  assert.equal(structureOptions?.responseSchema?.name, "rubric_structuring");
  assert.equal(evaluationOptions?.responseSchema?.name, "assignment_evaluation");
});
