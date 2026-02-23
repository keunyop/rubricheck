import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAssignment } from "../../../lib/evaluation";
import { RubricSchema, type Rubric } from "../../../lib/schema";
import { buildUsageLimitHeaders, checkUsageLimit } from "../../../src/lib/usageLimit";
import { createRequestContext, errorResponse } from "../../../src/lib/apiError";

const MAX_ASSIGNMENT_TEXT_LENGTH = 200_000;
const MAX_PATCH_EXCERPT_LENGTH = 6_000;
const MAX_PATCH_TEXT_LENGTH = 12_000;
const MAX_SIMULATION_ASSIGNMENT_LENGTH = 24_000;
const ESTIMATED_OVERALL_DELTA_CAP = 12;

const RangeTupleSchema = z
  .tuple([z.number().finite(), z.number().finite()])
  .refine(([low, high]) => low <= high, {
    message: "range must be [low, high] with low <= high",
  });

const OriginalCriteriaRowSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(200),
  estimated_range: RangeTupleSchema,
});

const OriginalEvaluationSchema = z
  .object({
    criteria_scores: z.array(OriginalCriteriaRowSchema).optional(),
    criteria: z.array(OriginalCriteriaRowSchema).optional(),
    overall_range: RangeTupleSchema.optional(),
  })
  .refine((value) => Array.isArray(value.criteria_scores) || Array.isArray(value.criteria), {
    message: "originalEvaluation must contain criteria_scores or criteria",
  });

const ProposedPatchSchema = z.object({
  type: z.enum(["replace_paragraph", "append_paragraph"]),
  originalExcerpt: z.string().trim().min(1).max(MAX_PATCH_EXCERPT_LENGTH),
  newText: z.string().trim().min(1).max(MAX_PATCH_TEXT_LENGTH),
});

const SimulateRequestSchema = z.object({
  structuredRubric: RubricSchema,
  originalEvaluation: OriginalEvaluationSchema,
  assignmentText: z.string().trim().min(1).max(MAX_ASSIGNMENT_TEXT_LENGTH),
  criteriaId: z.string().trim().min(1).max(120),
  proposedPatch: ProposedPatchSchema,
});

type OriginalCriteriaRow = z.infer<typeof OriginalCriteriaRowSchema>;
type ProposedPatch = z.infer<typeof ProposedPatchSchema>;

type PatchApplyResult = {
  patchedText: string;
  appendedFallback: boolean;
};

type TruncateResult = {
  text: string;
  truncated: boolean;
};

function normalizeCriterionKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundAndClampRange(range: [number, number], maxScore: number): [number, number] {
  const highLimit = Math.max(0, Math.floor(maxScore));
  let low = clamp(Math.round(range[0]), 0, highLimit);
  const high = clamp(Math.round(range[1]), 0, highLimit);

  if (low > high) {
    low = high;
  }

  return [low, high];
}

function getOriginalCriteriaRows(
  originalEvaluation: z.infer<typeof OriginalEvaluationSchema>,
): OriginalCriteriaRow[] {
  return originalEvaluation.criteria_scores ?? originalEvaluation.criteria ?? [];
}

function parseCriteriaIndex(criteriaId: string, criteriaCount: number): number | null {
  if (!/^\d+$/.test(criteriaId)) {
    return null;
  }

  const numeric = Number.parseInt(criteriaId, 10);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric >= 0 && numeric < criteriaCount) {
    return numeric;
  }

  if (numeric >= 1 && numeric <= criteriaCount) {
    return numeric - 1;
  }

  return null;
}

function resolveTargetCriterionIndex(
  criteriaId: string,
  rubric: Rubric,
  originalRows: OriginalCriteriaRow[],
): number | null {
  const byIndex = parseCriteriaIndex(criteriaId, rubric.criteria.length);
  if (byIndex !== null) {
    return byIndex;
  }

  const byIdRow = originalRows.find((row) => row.id === criteriaId);
  if (byIdRow) {
    const key = normalizeCriterionKey(byIdRow.name);
    const rubricIndex = rubric.criteria.findIndex(
      (criterion) => normalizeCriterionKey(criterion.name) === key,
    );
    if (rubricIndex !== -1) {
      return rubricIndex;
    }
  }

  const normalizedCriteriaId = normalizeCriterionKey(criteriaId);
  const rubricByName = rubric.criteria.findIndex(
    (criterion) => normalizeCriterionKey(criterion.name) === normalizedCriteriaId,
  );
  if (rubricByName !== -1) {
    return rubricByName;
  }

  const rowByName = originalRows.find((row) => normalizeCriterionKey(row.name) === normalizedCriteriaId);
  if (rowByName) {
    const rubricIndex = rubric.criteria.findIndex(
      (criterion) => normalizeCriterionKey(criterion.name) === normalizeCriterionKey(rowByName.name),
    );
    if (rubricIndex !== -1) {
      return rubricIndex;
    }
  }

  return null;
}

function findBeforeRange(
  criteriaId: string,
  criterionName: string,
  originalRows: OriginalCriteriaRow[],
  rubricIndex: number,
): [number, number] | null {
  const byId = originalRows.find((row) => row.id === criteriaId);
  if (byId) {
    return byId.estimated_range;
  }

  const normalizedName = normalizeCriterionKey(criterionName);
  const byName = originalRows.find((row) => normalizeCriterionKey(row.name) === normalizedName);
  if (byName) {
    return byName.estimated_range;
  }

  const byIndex = originalRows[rubricIndex];
  if (byIndex) {
    return byIndex.estimated_range;
  }

  return null;
}

function appendParagraph(baseText: string, paragraph: string): string {
  const normalizedParagraph = paragraph.trim();
  if (!normalizedParagraph) {
    return baseText;
  }

  const base = baseText.trimEnd();
  if (!base) {
    return normalizedParagraph;
  }

  return `${base}\n\n${normalizedParagraph}`;
}

function applyPatchToAssignment(assignmentText: string, patch: ProposedPatch): PatchApplyResult {
  if (patch.type === "append_paragraph") {
    return {
      patchedText: appendParagraph(assignmentText, patch.newText),
      appendedFallback: false,
    };
  }

  const excerptExact = patch.originalExcerpt;
  const exactIndex = assignmentText.indexOf(excerptExact);
  if (exactIndex !== -1) {
    const before = assignmentText.slice(0, exactIndex);
    const after = assignmentText.slice(exactIndex + excerptExact.length);
    return {
      patchedText: `${before}${patch.newText}${after}`,
      appendedFallback: false,
    };
  }

  const excerptTrimmed = patch.originalExcerpt.trim();
  const trimmedIndex = excerptTrimmed ? assignmentText.indexOf(excerptTrimmed) : -1;
  if (trimmedIndex !== -1) {
    const before = assignmentText.slice(0, trimmedIndex);
    const after = assignmentText.slice(trimmedIndex + excerptTrimmed.length);
    return {
      patchedText: `${before}${patch.newText}${after}`,
      appendedFallback: false,
    };
  }

  return {
    patchedText: appendParagraph(assignmentText, patch.newText),
    appendedFallback: true,
  };
}

function truncateByCodePoint(value: string, maxLength: number): TruncateResult {
  const codePoints = Array.from(value);
  if (codePoints.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return {
    text: codePoints.slice(0, maxLength).join(""),
    truncated: true,
  };
}

function capAfterRange(params: {
  beforeRange: [number, number];
  afterRange: [number, number];
  criterionMaxScore: number;
  totalRubricMaxScore: number;
}): {
  range: [number, number];
  capApplied: boolean;
  allowedPositiveIncrease: number;
} {
  const before = roundAndClampRange(params.beforeRange, params.criterionMaxScore);
  const after = roundAndClampRange(params.afterRange, params.criterionMaxScore);

  const criteriaDeltaCap = Math.max(0, Math.floor(params.criterionMaxScore * 0.2));
  const overallDeltaCapRaw = Math.max(
    0,
    Math.floor((ESTIMATED_OVERALL_DELTA_CAP / 100) * params.totalRubricMaxScore),
  );
  const allowedPositiveIncrease = Math.min(criteriaDeltaCap, overallDeltaCapRaw);

  let cappedLow = after[0];
  let cappedHigh = after[1];

  if (cappedLow > before[0] + allowedPositiveIncrease) {
    cappedLow = before[0] + allowedPositiveIncrease;
  }

  if (cappedHigh > before[1] + allowedPositiveIncrease) {
    cappedHigh = before[1] + allowedPositiveIncrease;
  }

  cappedLow = clamp(cappedLow, 0, Math.floor(params.criterionMaxScore));
  cappedHigh = clamp(cappedHigh, 0, Math.floor(params.criterionMaxScore));
  if (cappedLow > cappedHigh) {
    cappedLow = cappedHigh;
  }

  const capApplied = cappedLow !== after[0] || cappedHigh !== after[1];
  return {
    range: [cappedLow, cappedHigh],
    capApplied,
    allowedPositiveIncrease,
  };
}

function buildExplanation(params: {
  appendedFallback: boolean;
  assignmentTruncated: boolean;
  capApplied: boolean;
  allowedPositiveIncrease: number;
}): string {
  const messages = [
    "This simulation is an estimate, not a guaranteed score change.",
  ];

  if (params.appendedFallback) {
    messages.push("The original excerpt was not found, so the new paragraph was appended.");
  }

  if (params.assignmentTruncated) {
    messages.push("Patched assignment text was truncated for simulation limits.");
  }

  if (params.capApplied) {
    messages.push(
      `Conservative cap applied: criterion gain limited to +${params.allowedPositiveIncrease} point(s).`,
    );
  }

  return messages.join(" ");
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const usage = await checkUsageLimit(request, "simulate");
  const usageHeaders = buildUsageLimitHeaders(usage);

  if (usage.degradedCode === "REDIS_UNAVAILABLE") {
    usageHeaders["x-rubricheck-warning"] = "REDIS_UNAVAILABLE";
  }

  if (!usage.allowed) {
    const status = usage.errorCode === "REDIS_UNAVAILABLE" ? 503 : 429;
    const code = usage.errorCode ?? (status === 429 ? "RATE_LIMITED" : "REDIS_UNAVAILABLE");
    return errorResponse(context, status, code, usage.errorMessage ?? "Request unavailable right now.", undefined, usageHeaders);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse(context, 400, "INVALID_INPUT", "Request body must be valid JSON.", undefined, usageHeaders);
  }

  const parsedInput = SimulateRequestSchema.safeParse(payload);
  if (!parsedInput.success) {
    return errorResponse(context, 400, "INVALID_INPUT", "Please provide valid simulation inputs.", parsedInput.error.flatten(), usageHeaders);
  }

  const rubric = parsedInput.data.structuredRubric;
  const originalRows = getOriginalCriteriaRows(parsedInput.data.originalEvaluation);
  const criterionIndex = resolveTargetCriterionIndex(parsedInput.data.criteriaId, rubric, originalRows);

  if (criterionIndex === null || !rubric.criteria[criterionIndex]) {
    return errorResponse(context, 400, "CRITERIA_NOT_FOUND", "Criterion was not found in rubric.", undefined, usageHeaders);
  }

  const targetCriterion = rubric.criteria[criterionIndex];
  const beforeRangeRaw = findBeforeRange(
    parsedInput.data.criteriaId,
    targetCriterion.name,
    originalRows,
    criterionIndex,
  );

  if (!beforeRangeRaw) {
    return errorResponse(context, 400, "CRITERIA_BEFORE_RANGE_NOT_FOUND", "Could not resolve baseline criterion range.", undefined, usageHeaders);
  }

  const patchResult = applyPatchToAssignment(parsedInput.data.assignmentText, parsedInput.data.proposedPatch);
  const truncatedPatchedAssignment = truncateByCodePoint(
    patchResult.patchedText,
    MAX_SIMULATION_ASSIGNMENT_LENGTH,
  );

  try {
    const patchedEvaluation = await evaluateAssignment(rubric, truncatedPatchedAssignment.text);
    const matchedAfter = patchedEvaluation.criteria_scores.find(
      (item) => normalizeCriterionKey(item.name) === normalizeCriterionKey(targetCriterion.name),
    );

    const afterRangeRaw: [number, number] = matchedAfter
      ? matchedAfter.estimated_range
      : patchedEvaluation.criteria_scores[criterionIndex]?.estimated_range;

    if (!afterRangeRaw) {
      return errorResponse(context, 503, "SIMULATION_RESULT_INCOMPLETE", "Simulation result was incomplete. Please retry.", undefined, usageHeaders);
    }

    const totalRubricMaxScore = rubric.criteria.reduce((sum, criterion) => sum + criterion.max_score, 0);
    const beforeRange = roundAndClampRange(beforeRangeRaw, targetCriterion.max_score);
    const cappedAfter = capAfterRange({
      beforeRange,
      afterRange: afterRangeRaw,
      criterionMaxScore: targetCriterion.max_score,
      totalRubricMaxScore,
    });

    const afterRange = cappedAfter.range;
    const deltaRange: [number, number] = [
      afterRange[0] - beforeRange[0],
      afterRange[1] - beforeRange[1],
    ];

    const headers = new Headers(usageHeaders);
    headers.set("x-request-id", context.requestId);
    return NextResponse.json(
      {
        criteriaId: parsedInput.data.criteriaId,
        before: { range: beforeRange },
        after: { range: afterRange },
        delta: { range: deltaRange },
        explanation: buildExplanation({
          appendedFallback: patchResult.appendedFallback,
          assignmentTruncated: truncatedPatchedAssignment.truncated,
          capApplied: cappedAfter.capApplied,
          allowedPositiveIncrease: cappedAfter.allowedPositiveIncrease,
        }),
      },
      { headers },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "OPENAI_API_KEY_MISSING" || error.message === "EVALUATION_MODEL_MISSING")
    ) {
      return errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Simulation service is unavailable right now.", undefined, usageHeaders);
    }

    if (error instanceof Error && error.message === "OPENAI_TIMEOUT") {
      return errorResponse(context, 504, "OPENAI_TIMEOUT", "Our AI reviewer is taking longer than usual. Please retry in a moment.", undefined, usageHeaders);
    }

    return errorResponse(context, 503, "SIMULATION_FAILED", "Simulation failed. Please retry.", undefined, usageHeaders);
  }
}
