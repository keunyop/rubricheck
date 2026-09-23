import assert from "node:assert/strict";
import { test } from "node:test";
import { actualResultInputSchema, compareActualResult, type ActualResult } from "./actualResultTypes.ts";
import { analyzeActualResults } from "./actualResultAnalysis.ts";
import { evaluationProvenance } from "./evaluationProvenance.ts";

const input = { score: 16, maxScore: 20, comment: "", course: "", assignmentType: "essay", submissionMatch: "same",
  consent: { personalRecord: true, qualityValidation: false, publicCase: false }, expectedRevision: null };
const record = (overrides: Partial<ActualResult> = {}): ActualResult => ({
  ...actualResultInputSchema.parse(input), evaluationId: "one", revision: "revision", createdAt: 1, updatedAt: 1,
  consentVersion: "actual-results-v1", consentUpdatedAt: 1,
  estimate: { overallRange: [70, 80], mode: "standard", scoringVersion: "rubric-sum-v2",
    provenance: { model: "model-a", promptVersion: "prompt-a", inputFingerprint: "same-draft" } }, ...overrides,
});

test("actual results require an explicit personal choice and keep optional choices independent", () => {
  assert.equal(actualResultInputSchema.safeParse(input).success, true);
  for (const qualityValidation of [true, false]) for (const publicCase of [true, false]) {
    assert.equal(actualResultInputSchema.safeParse({ ...input, consent: { personalRecord: true, qualityValidation, publicCase } }).success, true);
  }
  for (const consent of [{}, { personalRecord: false, qualityValidation: false, publicCase: false }, { personalRecord: true }]) {
    assert.equal(actualResultInputSchema.safeParse({ ...input, consent }).success, false);
  }
  assert.equal(actualResultInputSchema.safeParse({ ...input, estimate: { overallRange: [99, 100] } }).success, false);
});

test("actual score validation rejects invalid values, accepts zero, decimals and comment-only records", () => {
  for (const patch of [{ score: -1 }, { score: 21 }, { score: NaN }, { score: Infinity }, { score: "16" },
    { maxScore: 0 }, { maxScore: -1 }, { maxScore: Infinity }, { maxScore: 1_000_001 },
    { score: null, comment: "  " }, { comment: "x".repeat(5001) }, { course: "x".repeat(81) }, { assignmentType: "invalid" }]) {
    assert.equal(actualResultInputSchema.safeParse({ ...input, ...patch }).success, false, JSON.stringify(patch));
  }
  for (const patch of [{ score: 0 }, { score: 16.25 }, { score: null, comment: " Useful feedback " }]) {
    assert.equal(actualResultInputSchema.safeParse({ ...input, ...patch }).success, true);
  }
  assert.equal(compareActualResult(record({ score: null })), null);
  assert.deepEqual(compareActualResult(record()), { actualPercent: 80, midpoint: 75, difference: 5, withinRange: true, distanceOutsideRange: 0 });
  assert.equal(compareActualResult(record({ score: 14 }))!.withinRange, true);
  assert.equal(compareActualResult(record({ score: 16.00001 }))!.withinRange, false);
  assert.equal(compareActualResult(record({ score: 0 }))!.distanceOutsideRange, 70);
  assert.equal(compareActualResult(record({ score: 19 }))!.difference, 20);
  const decimalBoundary = record({ score: 0.58, maxScore: 1, estimate: { ...record().estimate, overallRange: [58, 58] } });
  assert.equal(compareActualResult(decimalBoundary)!.withinRange, true);
  assert.equal(compareActualResult(decimalBoundary)!.difference, 0);
});

test("quality metrics enforce consent, separate versions/types, include misses, and measure exact repeated inputs", () => {
  const consent = { personalRecord: true as const, qualityValidation: true, publicCase: false };
  const first = record({ consent });
  const second = record({ evaluationId: "two", consent, estimate: { ...first.estimate, overallRange: [60, 70] } });
  const third = record({ evaluationId: "three", consent, assignmentType: "report" });
  const changedModel = record({ evaluationId: "four", consent, estimate: { ...first.estimate, provenance: { ...first.estimate.provenance!, model: "model-b" } } });
  const excluded = [
    record({ evaluationId: "private" }), record({ evaluationId: "public-only", consent: { ...consent, qualityValidation: false, publicCase: true } }),
    record({ evaluationId: "revised", consent, submissionMatch: "revised" }), record({ evaluationId: "unknown", consent, submissionMatch: "unknown" }),
    record({ evaluationId: "comment-only", consent, score: null }),
  ];
  const report = analyzeActualResults([first, second, third, changedModel, ...excluded]);
  assert.equal(report.calibrationStatus, "not_established");
  assert.equal(report.groups.length, 3);
  assert.deepEqual(report.groups[0], {
    assignmentType: "essay", mode: "standard", scoringVersion: "rubric-sum-v2", model: "model-a", promptVersion: "prompt-a",
    observationCount: 2, distinctKnownInputs: 1, observationsWithoutComparableProvenance: 0,
    midpointMeanAbsoluteError: 10, actualMinusMidpointBias: 10, observedRangeCoverage: 0.5, meanRangeWidth: 10,
    repeatedInputCount: 1, meanRepeatedMidpointSpread: 10,
  });
  assert.equal(analyzeActualResults([first, { ...first, updatedAt: 2, consent: { ...consent, qualityValidation: false } }]).groups.length, 0);
  assert.equal(analyzeActualResults([first, { ...second, score: 12 }]).groups[0].repeatedInputCount, 0);
  const legacy = record({ consent, estimate: { ...first.estimate, provenance: null } });
  assert.equal(analyzeActualResults([legacy]).groups[0].meanRepeatedMidpointSpread, null);
  assert.deepEqual(analyzeActualResults([]).groups, []);
});

test("provenance distinguishes changed inputs, grading modes and detail prompts without model calls", () => {
  const rubric = { criteria: [{ name: "Evidence", max_score: 100, description: "Evidence" }] };
  const first = evaluationProvenance(rubric, "Draft", "standard", false);
  assert.deepEqual(first, evaluationProvenance(rubric, "Draft", "standard", false));
  assert.notEqual(first.inputFingerprint, evaluationProvenance(rubric, "Revised", "standard", false).inputFingerprint);
  assert.equal(first.promptVersion, evaluationProvenance(rubric, "Revised", "standard", false).promptVersion);
  assert.notEqual(first.promptVersion, evaluationProvenance(rubric, "Draft", "strict", false).promptVersion);
  assert.notEqual(first.promptVersion, evaluationProvenance(rubric, "Draft", "standard", true).promptVersion);
});
