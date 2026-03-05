import type { FinalEvaluation } from "./gradeFinalization";
import type { GradingMode, Rubric } from "./schema";

export const EVALUATION_QUALITY_GUARDRAIL_VERSION = "2026-03-05-v1";

export const EVALUATION_QUALITY_GUARDRAIL_THRESHOLDS = {
  expectedTopImprovements: 3,
  minStrictEvidenceItems: 1,
  maxStrictEvidenceItems: 2,
} as const;

export type EvaluationQualityAssessment = {
  passed: boolean;
  hardFailures: string[];
  metrics: {
    rubricCriteriaCount: number;
    resultCriteriaCount: number;
    strictMissingEvidenceCount: number;
    strictInvalidEvidenceCount: number;
    topImprovementsCount: number;
    emptyFeedbackCount: number;
  };
};

export function assessFinalEvaluationQuality(
  rubric: Rubric,
  finalEvaluation: FinalEvaluation,
  mode: GradingMode,
): EvaluationQualityAssessment {
  const hardFailures: string[] = [];
  const rubricCriteriaCount = rubric.criteria.length;
  const resultCriteriaCount = finalEvaluation.criteria.length;
  let strictMissingEvidenceCount = 0;
  let strictInvalidEvidenceCount = 0;
  let emptyFeedbackCount = 0;

  if (resultCriteriaCount !== rubricCriteriaCount) {
    hardFailures.push("criteria_count_mismatch");
  }

  const topImprovementsCount = finalEvaluation.top_improvements.length;
  if (topImprovementsCount !== EVALUATION_QUALITY_GUARDRAIL_THRESHOLDS.expectedTopImprovements) {
    hardFailures.push("top_improvements_not_exactly_three");
  }

  for (const criterion of finalEvaluation.criteria) {
    if (!criterion.feedback || criterion.feedback.trim().length === 0) {
      emptyFeedbackCount += 1;
    }

    if (mode !== "strict") {
      continue;
    }

    if (!criterion.evidence) {
      strictMissingEvidenceCount += 1;
      continue;
    }

    const evidenceLength = criterion.evidence.length;
    if (
      evidenceLength < EVALUATION_QUALITY_GUARDRAIL_THRESHOLDS.minStrictEvidenceItems ||
      evidenceLength > EVALUATION_QUALITY_GUARDRAIL_THRESHOLDS.maxStrictEvidenceItems
    ) {
      strictInvalidEvidenceCount += 1;
    }
  }

  if (emptyFeedbackCount > 0) {
    hardFailures.push("empty_feedback_present");
  }
  if (mode === "strict" && strictMissingEvidenceCount > 0) {
    hardFailures.push("strict_evidence_missing");
  }
  if (mode === "strict" && strictInvalidEvidenceCount > 0) {
    hardFailures.push("strict_evidence_invalid_count");
  }

  return {
    passed: hardFailures.length === 0,
    hardFailures,
    metrics: {
      rubricCriteriaCount,
      resultCriteriaCount,
      strictMissingEvidenceCount,
      strictInvalidEvidenceCount,
      topImprovementsCount,
      emptyFeedbackCount,
    },
  };
}
