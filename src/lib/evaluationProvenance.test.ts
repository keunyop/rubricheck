import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluationProvenance } from "./evaluationProvenance.ts";

test("provenance distinguishes changed inputs, grading modes and detail prompts without model calls", () => {
  const rubric = { criteria: [{ name: "Evidence", max_score: 100, description: "Evidence" }] };
  const first = evaluationProvenance(rubric, "Draft", "standard", false);
  assert.deepEqual(first, evaluationProvenance(rubric, "Draft", "standard", false));
  assert.notEqual(first.inputFingerprint, evaluationProvenance(rubric, "Revised", "standard", false).inputFingerprint);
  assert.equal(first.promptVersion, evaluationProvenance(rubric, "Revised", "standard", false).promptVersion);
  assert.notEqual(first.promptVersion, evaluationProvenance(rubric, "Draft", "strict", false).promptVersion);
  assert.notEqual(first.promptVersion, evaluationProvenance(rubric, "Draft", "standard", true).promptVersion);
});
