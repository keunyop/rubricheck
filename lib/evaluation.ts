import { callEvaluationModel } from "./openai";
import {
  buildEvaluationPrompt,
  STRICT_JSON_SYSTEM_INSTRUCTION,
  type EvaluationDetailLevel,
} from "./evaluationPrompt";
import { normalizeModelEvaluation } from "./evaluationNormalization.ts";
import {
  EvaluationSchema,
  GradingModeSchema,
  StrictEvaluationSchema,
  type Evaluation,
  type GradingMode,
  type Rubric,
} from "./schema";

function parseEvaluationByMode(mode: GradingMode, normalizedResult: unknown): Evaluation {
  if (mode === "strict") {
    const parsed = StrictEvaluationSchema.safeParse(normalizedResult);
    if (!parsed.success) {
      console.error("STRICT_EVALUATION_SCHEMA_VALIDATION_FAILED", parsed.error.flatten());
      throw new Error("EVALUATION_FAILED");
    }

    return parsed.data;
  }

  const parsed = EvaluationSchema.safeParse(normalizedResult);
  if (!parsed.success) {
    console.error("EVALUATION_SCHEMA_VALIDATION_FAILED", parsed.error.flatten());
    throw new Error("EVALUATION_FAILED");
  }

  return parsed.data;
}

export async function evaluateAssignment(
  rubric: Rubric,
  assignmentText: string,
  mode: GradingMode = GradingModeSchema.enum.standard,
  options?: {
    detailLevel?: EvaluationDetailLevel;
  },
): Promise<Evaluation> {
  const prompt = buildEvaluationPrompt(
    rubric,
    assignmentText,
    mode,
    options?.detailLevel ?? "diagnostic",
  );

  try {
    const modelResult =
      mode === "strict"
        ? await callEvaluationModel(prompt, { systemInstruction: STRICT_JSON_SYSTEM_INSTRUCTION })
        : await callEvaluationModel(prompt);
    const normalizedResult = normalizeModelEvaluation(modelResult);
    return parseEvaluationByMode(mode, normalizedResult);
  } catch (error) {
    if (error instanceof Error && (error.message === "EVALUATION_FAILED" || error.message === "OPENAI_TIMEOUT")) {
      throw error;
    }
    console.error("EVALUATION_MODEL_CALL_FAILED", error);
    throw new Error("EVALUATION_FAILED");
  }
}
