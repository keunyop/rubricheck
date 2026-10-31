import { callEvaluationModel } from "./openai";
import type { Locale } from "../src/i18n/config";
import {
  buildEvaluationPrompt,
  STRICT_JSON_SYSTEM_INSTRUCTION,
  type EvaluationDetailLevel,
} from "./evaluationPrompt";
import { normalizeModelEvaluation } from "./evaluationNormalization.ts";
import { buildScoreAdjustments } from "./gradeFinalization.ts";
import {
  EvaluationSchema,
  GradingModeSchema,
  StrictEvaluationSchema,
  type Evaluation,
  type GradingMode,
  type Rubric,
} from "./schema";

class EvaluationValidationError extends Error {
  issues: { code: string; path: string }[];
  constructor(issues: { code: string; path: PropertyKey[] }[]) {
    super("EVALUATION_FAILED");
    this.issues = issues.map(issue => ({ code: issue.code, path: issue.path.join(".") }));
  }
}

function parseEvaluationByMode(mode: GradingMode, normalizedResult: unknown): Evaluation {
  const parsed = (mode === "strict" ? StrictEvaluationSchema : EvaluationSchema).safeParse(normalizedResult);
  if (!parsed.success) {
    throw new EvaluationValidationError(parsed.error.issues);
  }

  return parsed.data;
}

export async function evaluateAssignment(
  rubric: Rubric,
  assignmentText: string,
  mode: GradingMode = GradingModeSchema.enum.standard,
  options?: {
    detailLevel?: EvaluationDetailLevel;
    language?: Locale;
    requestId?: string;
  },
): Promise<Evaluation> {
  const prompt = buildEvaluationPrompt(
    rubric,
    assignmentText,
    mode,
    options?.detailLevel ?? "diagnostic",
    options?.language ?? "en",
  );

  const startedAt = Date.now();
  let retryInstruction = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const modelResult = await callEvaluationModel(prompt + retryInstruction, {
        startedAt,
        ...(mode === "strict" ? { systemInstruction: STRICT_JSON_SYSTEM_INSTRUCTION } : {}),
      });
      const evaluation = parseEvaluationByMode(mode, normalizeModelEvaluation(modelResult));
      try { buildScoreAdjustments(rubric, evaluation); }
      catch { throw new EvaluationValidationError([{ code: "custom", path: ["score_adjustments"] }]); }
      return evaluation;
    } catch (error) {
      if (error instanceof Error && error.message === "OPENAI_TIMEOUT") throw error;
      const invalidJson = error instanceof Error && error.message === "MODEL_JSON_PARSE_FAILED";
      const issues = error instanceof EvaluationValidationError ? error.issues : invalidJson ? [{ code: "invalid_json", path: "" }] : null;
      if (issues) {
        const log = { requestId: options?.requestId, mode, attempt: attempt + 1, issues };
        if (attempt === 0) {
          console.warn("EVALUATION_OUTPUT_RETRY", log);
          retryInstruction = [
            "", "", "Re-evaluate the assignment: the previous response failed validation.",
            `Invalid fields: ${JSON.stringify(issues)}.`,
            "Return the complete JSON evaluation, preserving the rubric and all grading requirements.",
            "Scores and adjustment points must be nonnegative. Keep explicit rubric deductions/bonuses in score_adjustments only, using positive magnitudes and exactly the supplied adjustment names. Include every adjustment, even when points is zero. Never add an adjustment to criteria_scores.",
            "Check all numeric ranges, required fields, evidence, and text limits before returning.",
          ].join("\n");
          continue;
        }
        console.error("EVALUATION_SCHEMA_VALIDATION_FAILED", log);
      } else {
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        console.error("EVALUATION_MODEL_CALL_FAILED", {
          requestId: options?.requestId, reason: "provider_error",
          ...(typeof status === "number" ? { upstreamStatus: status } : {}),
        });
      }
      throw new Error("EVALUATION_FAILED");
    }
  }
  throw new Error("EVALUATION_FAILED");
}
