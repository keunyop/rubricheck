import { createHash } from "node:crypto";

import { buildEvaluationJsonSchema, type EvaluationDetailLevel } from "./evaluationPrompt.ts";
import type { JsonModelOptions } from "./openai.ts";
import type { GradingMode, Rubric } from "./schema.ts";

export type EvaluationOptimizationVariant = "control" | "optimized";
export type ServedEvaluationVariant = EvaluationOptimizationVariant | "fallback_control";

const MIN_ROLLOUT_PERCENT = 0;
const MAX_ROLLOUT_PERCENT = 100;
const DEFAULT_ROLLOUT_PERCENT = 0;

const MIN_STRUCTURE_OUTPUT_TOKENS = 800;
const MAX_STRUCTURE_OUTPUT_TOKENS = 3_600;
const MIN_EVALUATION_OUTPUT_TOKENS = 1_200;
const MAX_EVALUATION_OUTPUT_TOKENS = 12_000;

const STRUCTURE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    criteria: {
      type: "array",
      minItems: 1,
      maxItems: 64,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          max_score: { type: "number" },
          description: { type: "string" },
        },
        required: ["name", "max_score", "description"],
      },
    },
  },
  required: ["criteria"],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseRolloutPercent(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ROLLOUT_PERCENT;
  }

  return clamp(parsed, MIN_ROLLOUT_PERCENT, MAX_ROLLOUT_PERCENT);
}

function resolveVariantOverride(value: string | null | undefined): EvaluationOptimizationVariant | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "control") {
    return "control";
  }
  if (normalized === "optimized") {
    return "optimized";
  }

  return null;
}

function buildDeterministicBucket(seed: string): number {
  const hash = createHash("sha256").update(seed).digest("hex");
  const bucketSource = hash.slice(0, 8);
  const parsed = Number.parseInt(bucketSource, 16);
  if (!Number.isFinite(parsed)) {
    return 99;
  }

  return parsed % 100;
}

function countWords(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/g).length;
}

function estimateStructureMaxOutputTokens(rubricText: string): number {
  const words = countWords(rubricText);
  const estimatedCriteria = clamp(Math.ceil(words / 110), 3, 24);
  const tokenBudget = 320 + estimatedCriteria * 140;
  return clamp(tokenBudget, MIN_STRUCTURE_OUTPUT_TOKENS, MAX_STRUCTURE_OUTPUT_TOKENS);
}

function estimateEvaluationMaxOutputTokens(
  rubric: Rubric,
  mode: GradingMode,
  detailLevel: EvaluationDetailLevel,
): number {
  const criteriaCount = Math.max(1, rubric.criteria.length);
  const base = 420;

  const perCriterion =
    detailLevel === "detailed"
      ? mode === "strict"
        ? 320
        : 280
      : mode === "strict"
        ? 210
        : 170;

  const tokenBudget = base + criteriaCount * perCriterion;
  return clamp(tokenBudget, MIN_EVALUATION_OUTPUT_TOKENS, MAX_EVALUATION_OUTPUT_TOKENS);
}

export function resolveEvaluationOptimizationVariant(
  requestId: string,
  options?: { headerOverride?: string | null },
): { requestedVariant: EvaluationOptimizationVariant; rolloutPercent: number } {
  const overrideVariant = resolveVariantOverride(options?.headerOverride);
  if (overrideVariant) {
    return { requestedVariant: overrideVariant, rolloutPercent: parseRolloutPercent(process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT) };
  }

  const forcedVariant = resolveVariantOverride(process.env.EVAL_OPTIMIZATION_FORCE_VARIANT);
  if (forcedVariant) {
    return { requestedVariant: forcedVariant, rolloutPercent: parseRolloutPercent(process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT) };
  }

  const rolloutPercent = parseRolloutPercent(process.env.EVAL_OPTIMIZATION_ROLLOUT_PERCENT);
  if (rolloutPercent <= 0) {
    return { requestedVariant: "control", rolloutPercent };
  }

  const bucket = buildDeterministicBucket(requestId);
  return {
    requestedVariant: bucket < rolloutPercent ? "optimized" : "control",
    rolloutPercent,
  };
}

export function buildStructureModelOptions(
  variant: EvaluationOptimizationVariant,
  rubricText: string,
): JsonModelOptions | undefined {
  if (variant !== "optimized") {
    return undefined;
  }

  return {
    maxOutputTokens: estimateStructureMaxOutputTokens(rubricText),
    retryOnMaxOutputTokens: true,
    responseSchema: {
      name: "rubric_structuring",
      schema: STRUCTURE_RESPONSE_SCHEMA,
      strict: true,
    },
  };
}

export function buildEvaluationModelOptions(
  variant: EvaluationOptimizationVariant,
  rubric: Rubric,
  mode: GradingMode,
  detailLevel: EvaluationDetailLevel,
): JsonModelOptions | undefined {
  if (variant !== "optimized") {
    return undefined;
  }

  return {
    maxOutputTokens: estimateEvaluationMaxOutputTokens(rubric, mode, detailLevel),
    retryOnMaxOutputTokens: true,
    responseSchema: {
      name: "assignment_evaluation",
      schema: buildEvaluationJsonSchema(rubric, mode, detailLevel),
      strict: true,
    },
  };
}
