import type { Evaluation, GradingMode, Rubric } from "./schema";

const STRICT_OVERALL_PENALTY = 3;
const STANDARD_OVERALL_BONUS = 4;
const MAX_OVERALL_RANGE_WIDTH = 15;

export type FeedbackAccessTier = "free" | "pro";

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
  overall_range: [number, number];
  summary: string;
  top_improvements: string[];
  criteria: FinalCriterion[];
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

  const widthLimit = Math.max(2, Math.round(maxScore * 0.25));

  if (high - low > widthLimit) {
    const center = Math.round((low + high) / 2);
    low = Math.max(0, center - Math.round(widthLimit / 2));
    high = Math.min(maxAllowed, low + widthLimit);
    high = Math.max(0, high);

    if (low > high) {
      low = high;
    }
  }

  return [low, high];
}

function applyOverallRangeWidthCap(range: [number, number]): [number, number] {
  let [scaledLow, scaledHigh] = range;

  if (scaledLow > scaledHigh) {
    [scaledLow, scaledHigh] = [scaledHigh, scaledLow];
  }

  if (scaledHigh - scaledLow > MAX_OVERALL_RANGE_WIDTH) {
    const center = Math.round((scaledLow + scaledHigh) / 2);
    scaledLow = Math.max(0, center - Math.floor(MAX_OVERALL_RANGE_WIDTH / 2));
    scaledHigh = Math.min(100, scaledLow + MAX_OVERALL_RANGE_WIDTH);
    if (scaledLow > scaledHigh) {
      scaledLow = scaledHigh;
    }
  }

  return [scaledLow, scaledHigh];
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

function normalizeOverallRangeForStandard(
  criteria: Array<{ estimated_range: [number, number] }>,
  rubricTotal: number,
): [number, number] {
  const [scaledLow, scaledHigh] = scaleOverallRawRange(criteria, rubricTotal);
  const upliftedLow = clamp(scaledLow + STANDARD_OVERALL_BONUS, 0, 100);
  const upliftedHigh = clamp(scaledHigh + STANDARD_OVERALL_BONUS, 0, 100);
  return applyOverallRangeWidthCap([upliftedLow, upliftedHigh]);
}

function normalizeOverallRangeForStrict(
  criteria: Array<{ estimated_range: [number, number] }>,
  rubricTotal: number,
): [number, number] {
  const [scaledLow, scaledHigh] = scaleOverallRawRange(criteria, rubricTotal);
  const penalizedLow = clamp(scaledLow - STRICT_OVERALL_PENALTY, 0, 100);
  const penalizedHigh = clamp(scaledHigh - STRICT_OVERALL_PENALTY, 0, 100);
  return applyOverallRangeWidthCap([penalizedLow, penalizedHigh]);
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

    if (tier === "free") {
      criteria.push({
        ...baseCriterion,
        detailed_breakdown_locked: true,
      });
      continue;
    }

    const detailedBreakdown = readDetailedBreakdown(matchedScore);
    const exampleRevisions = readExampleRevisions(matchedScore);

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

    if (tier === "free") {
      criteria.push({
        ...baseCriterion,
        detailed_breakdown_locked: true,
      });
      continue;
    }

    const detailedBreakdown = readDetailedBreakdown(matchedScore);
    const exampleRevisions = readExampleRevisions(matchedScore);

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

  const overallRange =
    mode === "strict"
      ? normalizeOverallRangeForStrict(criteria, rubricTotal)
      : normalizeOverallRangeForStandard(criteria, rubricTotal);

  if (evaluation.top_improvements.length < 3) {
    throw new Error("EVALUATION_FAILED");
  }

  const topImprovements = evaluation.top_improvements.slice(0, 3);

  if (tier === "free") {
    assertFreeCriteriaSafety(criteria);
  }

  return {
    title: "Evaluation Summary",
    overall_range: overallRange,
    summary: evaluation.summary,
    top_improvements: topImprovements,
    criteria,
  };
}
