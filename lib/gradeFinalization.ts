import type { Evaluation, GradingMode, Rubric } from "./schema";
import type { HiddenAiDocumentAlert } from "./hiddenAiAlert.ts";
import {
  canAccessDetailedFeedback,
  canAccessRewriteSuggestions,
  getVisibleTopImprovementsCount,
  type AccountFeatureTier,
} from "../src/lib/accountFeatureAccess.ts";

export type FeedbackAccessTier = AccountFeatureTier;

type FinalCriterion = {
  name: string;
  max_score: number;
  score: number;
  rationale: string;
  estimated_range: [number, number];
  feedback: string;
  evidence?: string[];
  detailed_breakdown?: string;
  example_revisions?: string[];
  detailed_breakdown_locked?: boolean;
};

export type FinalEvaluation = {
  title: string;
  grading_basis?: "general";
  access_tier: FeedbackAccessTier;
  overall_range: [number, number];
  score_calculation?: {
    version: "rubric-sum-v2";
    range_kind: "uncalibrated_estimate";
    grading_mode: GradingMode;
    rubric_total: number;
    criteria_range_sum: [number, number];
    mode_adjustment: 0;
  };
  summary: string;
  top_improvements: string[];
  criteria: FinalCriterion[];
  hidden_ai_alert?: HiddenAiDocumentAlert;
};

type EvaluationCriterionScore = Evaluation["criteria_scores"][number];

function readDetailedBreakdown(score: EvaluationCriterionScore): string | undefined {
  const value = (score as { detailed_breakdown?: unknown }).detailed_breakdown;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readExampleRevisions(score: EvaluationCriterionScore): string[] | undefined {
  const value = (score as { example_revisions?: unknown }).example_revisions;
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 2);

  return normalized.length > 0 ? normalized : undefined;
}

function buildFallbackExampleRevision(criterionName: string, feedback: string): string {
  const cleanedFeedback = feedback.replace(/\s+/g, " ").trim();
  if (!cleanedFeedback) {
    return `Revise the ${criterionName} section to align more directly with rubric expectations.`;
  }

  return `Revise ${criterionName}: ${cleanedFeedback}`.slice(0, 300);
}

function normalizeCriterionName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampCriterionRange(
  estimatedRange: [number, number],
  maxScore: number,
): [number, number] {
  const maxAllowed = Math.max(0, Math.floor(maxScore));

  let low = Math.round(estimatedRange[0]);
  let high = Math.round(estimatedRange[1]);

  low = Math.max(0, low);
  high = Math.min(maxAllowed, high);
  high = Math.max(0, high);

  if (low > high) {
    low = high;
  }

  return [low, high];
}

function scaleOverallRawRange(
  criteria: Array<{ estimated_range: [number, number] }>,
  rubricTotal: number,
): [number, number] {
  const overallRawLow = criteria.reduce((sum, criterion) => sum + criterion.estimated_range[0], 0);
  const overallRawHigh = criteria.reduce((sum, criterion) => sum + criterion.estimated_range[1], 0);

  const scaledLow = clamp(Math.round((overallRawLow / rubricTotal) * 100), 0, 100);
  const scaledHigh = clamp(Math.round((overallRawHigh / rubricTotal) * 100), 0, 100);

  return [scaledLow, scaledHigh];
}

function buildScoreByName(evaluation: Evaluation): Map<string, EvaluationCriterionScore> {
  const scoreByName = new Map<string, EvaluationCriterionScore>();

  for (const score of evaluation.criteria_scores) {
    const key = normalizeCriterionName(score.name);
    if (!key || scoreByName.has(key)) {
      throw new Error("EVALUATION_FAILED");
    }

    scoreByName.set(key, score);
  }

  return scoreByName;
}

function buildStandardCriteria(
  rubric: Rubric,
  scoreByName: Map<string, EvaluationCriterionScore>,
  tier: FeedbackAccessTier,
): FinalCriterion[] {
  const criteria: FinalCriterion[] = [];
  const rubricNameSet = new Set<string>();

  for (const rubricCriterion of rubric.criteria) {
    const key = normalizeCriterionName(rubricCriterion.name);
    if (!key || rubricNameSet.has(key)) {
      throw new Error("EVALUATION_FAILED");
    }
    rubricNameSet.add(key);

    const matchedScore = scoreByName.get(key);
    if (!matchedScore) {
      throw new Error("EVALUATION_FAILED");
    }

    const estimatedRange = clampCriterionRange(
      matchedScore.estimated_range,
      rubricCriterion.max_score,
    );
    const score = clamp(Math.round(matchedScore.score), 0, Math.max(0, Math.round(rubricCriterion.max_score)));
    const evidence = matchedScore.evidence?.slice(0, 2);

    const baseCriterion: FinalCriterion = {
      name: rubricCriterion.name,
      max_score: rubricCriterion.max_score,
      score,
      rationale: matchedScore.rationale,
      estimated_range: estimatedRange,
      feedback: matchedScore.feedback,
      ...(evidence ? { evidence } : {}),
    };

    if (!canAccessDetailedFeedback(tier)) {
      criteria.push({
        ...baseCriterion,
        detailed_breakdown_locked: true,
      });
      continue;
    }

    const detailedBreakdown = readDetailedBreakdown(matchedScore);
    const exampleRevisions = canAccessRewriteSuggestions(tier)
      ? readExampleRevisions(matchedScore) ??
        [buildFallbackExampleRevision(rubricCriterion.name, matchedScore.feedback)]
      : undefined;

    criteria.push({
      ...baseCriterion,
      ...(detailedBreakdown ? { detailed_breakdown: detailedBreakdown } : {}),
      ...(exampleRevisions ? { example_revisions: exampleRevisions } : {}),
    });
  }

  return criteria;
}

function buildStrictCriteria(
  rubric: Rubric,
  scoreByName: Map<string, EvaluationCriterionScore>,
  tier: FeedbackAccessTier,
): FinalCriterion[] {
  const criteria: FinalCriterion[] = [];
  const rubricNameSet = new Set<string>();

  for (const rubricCriterion of rubric.criteria) {
    const key = normalizeCriterionName(rubricCriterion.name);
    if (!key || rubricNameSet.has(key)) {
      throw new Error("EVALUATION_FAILED");
    }
    rubricNameSet.add(key);

    const matchedScore = scoreByName.get(key);
    if (!matchedScore) {
      throw new Error("EVALUATION_FAILED");
    }

    const evidence = matchedScore.evidence?.slice(0, 2);
    if (!evidence || evidence.length < 1 || evidence.length > 2) {
      throw new Error("EVALUATION_FAILED");
    }

    const estimatedRange = clampCriterionRange(
      matchedScore.estimated_range,
      rubricCriterion.max_score,
    );
    const score = clamp(Math.round(matchedScore.score), 0, Math.max(0, Math.round(rubricCriterion.max_score)));

    const baseCriterion: FinalCriterion = {
      name: rubricCriterion.name,
      max_score: rubricCriterion.max_score,
      score,
      rationale: matchedScore.rationale,
      estimated_range: estimatedRange,
      feedback: matchedScore.feedback,
      evidence,
    };

    if (!canAccessDetailedFeedback(tier)) {
      criteria.push({
        ...baseCriterion,
        detailed_breakdown_locked: true,
      });
      continue;
    }

    const detailedBreakdown = readDetailedBreakdown(matchedScore);
    const exampleRevisions = canAccessRewriteSuggestions(tier)
      ? readExampleRevisions(matchedScore) ??
        [buildFallbackExampleRevision(rubricCriterion.name, matchedScore.feedback)]
      : undefined;

    criteria.push({
      ...baseCriterion,
      ...(detailedBreakdown ? { detailed_breakdown: detailedBreakdown } : {}),
      ...(exampleRevisions ? { example_revisions: exampleRevisions } : {}),
    });
  }

  return criteria;
}

function assertFreeCriteriaSafety(criteria: FinalCriterion[]): void {
  for (const criterion of criteria) {
    if (!criterion.feedback || typeof criterion.feedback !== "string") {
      throw new Error("EVALUATION_FAILED");
    }
  }
}

export function buildFinalEvaluation(
  rubric: Rubric,
  evaluation: Evaluation,
  mode: GradingMode,
  tier: FeedbackAccessTier,
): FinalEvaluation {
  const scoreByName = buildScoreByName(evaluation);

  const criteria =
    mode === "strict"
      ? buildStrictCriteria(rubric, scoreByName, tier)
      : buildStandardCriteria(rubric, scoreByName, tier);

  if (criteria.length !== evaluation.criteria_scores.length) {
    throw new Error("EVALUATION_FAILED");
  }

  const rubricTotal = rubric.criteria.reduce((sum, criterion) => sum + criterion.max_score, 0);
  if (!Number.isFinite(rubricTotal) || rubricTotal <= 0) {
    throw new Error("EVALUATION_FAILED");
  }

  // Model output ranges are not empirically calibrated confidence intervals.
  const overallRange = scaleOverallRawRange(criteria, rubricTotal);

  if (evaluation.top_improvements.length < 3) {
    throw new Error("EVALUATION_FAILED");
  }

  const topImprovements = evaluation.top_improvements.slice(0, getVisibleTopImprovementsCount(tier));

  if (tier === "free") {
    assertFreeCriteriaSafety(criteria);
  }

  return {
    title: "Evaluation Summary",
    access_tier: tier,
    overall_range: overallRange,
    score_calculation: {
      version: "rubric-sum-v2",
      range_kind: "uncalibrated_estimate",
      grading_mode: mode,
      rubric_total: rubricTotal,
      criteria_range_sum: [
        criteria.reduce((sum, criterion) => sum + criterion.estimated_range[0], 0),
        criteria.reduce((sum, criterion) => sum + criterion.estimated_range[1], 0),
      ],
      mode_adjustment: 0,
    },
    summary: evaluation.summary,
    top_improvements: topImprovements,
    criteria,
  };
}

// Apply the same policy to legacy saved responses as to newly generated results.
export function restrictEvaluationFeedback<T extends FinalEvaluation>(result: T): T {
  return {
    ...result,
    top_improvements: result.top_improvements.slice(0, getVisibleTopImprovementsCount(result.access_tier)),
    criteria: result.criteria.map((criterion) => {
      const { detailed_breakdown, example_revisions, ...base } = criterion;
      return {
        ...base,
        ...(canAccessDetailedFeedback(result.access_tier)
          ? { detailed_breakdown }
          : { detailed_breakdown_locked: true }),
        ...(canAccessRewriteSuggestions(result.access_tier) ? { example_revisions } : {}),
      };
    }),
  };
}
