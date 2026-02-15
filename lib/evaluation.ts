import { callEvaluationModel } from "./openai";
import { EvaluationSchema, type Evaluation, type Rubric } from "./schema";

function normalizeSummary(summary: unknown): unknown {
  if (typeof summary !== "string") {
    return summary;
  }

  const sentences = summary
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((part) => part.length > 0);

  const limited = sentences.slice(0, 2).join(" ").trim();
  return limited.slice(0, 280);
}

function normalizeTopImprovements(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value
    .filter((item) => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim().slice(0, 120))
    .filter((item) => item.length > 0)
    .slice(0, 3);

  return normalized;
}

function normalizeCriteriaScores(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const row = item as Record<string, unknown>;
    const estimated = Array.isArray(row.estimated_range) ? row.estimated_range : [];

    const lowRaw = estimated[0];
    const highRaw = estimated[1];
    const low = Number.isFinite(Number(lowRaw)) ? Math.round(Number(lowRaw)) : lowRaw;
    const high = Number.isFinite(Number(highRaw)) ? Math.round(Number(highRaw)) : highRaw;

    return {
      ...row,
      feedback:
        typeof row.feedback === "string"
          ? row.feedback.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140)
          : row.feedback,
      estimated_range: [low, high],
    };
  });
}

function normalizeModelEvaluation(modelResult: unknown): unknown {
  if (!modelResult || typeof modelResult !== "object") {
    return modelResult;
  }

  const source = modelResult as Record<string, unknown>;

  return {
    ...source,
    summary: normalizeSummary(source.summary),
    top_improvements: normalizeTopImprovements(source.top_improvements),
    criteria_scores: normalizeCriteriaScores(source.criteria_scores),
  };
}

export async function evaluateAssignment(rubric: Rubric, assignmentText: string): Promise<Evaluation> {
  const criteriaForScoring = rubric.criteria.map((criterion) => ({
    name: criterion.name,
    max_score: criterion.max_score,
  }));

  const prompt = [
    "Evaluate the assignment using the provided rubric.",
    "Return JSON only, matching this schema exactly:",
    `{
  "summary": "string",
  "criteria_scores": [
    {
      "name": "string",
      "estimated_range": [integer, integer],
      "feedback": "string"
    }
  ],
  "top_improvements": ["string", "string", "string"]
}`,
    "Rules:",
    "- Use the rubric criterion names exactly as given.",
    "- Include one criteria_scores item per rubric criterion.",
    "- estimated_range must be [low, high] integers with low <= high.",
    "- Keep each range width modest; target width <= 20% of that criterion max_score.",
    "- feedback must be one line, <= 140 chars, and neutral in tone.",
    "- feedback should avoid harsh judgment and use constructive, factual wording.",
    "- summary must be 1-2 sentences, <= 280 chars, and neutral in tone.",
    "- top_improvements must contain exactly 3 items, each <= 120 chars.",
    "- Do not include numbering prefixes in top_improvements.",
    "- No markdown. No extra keys. No extra text.",
    "- Keep criteria_scores in the same order as rubric criteria.",
    "",
    "Rubric criteria (use these names exactly):",
    JSON.stringify(criteriaForScoring),
    "",
    "Assignment text:",
    assignmentText,
  ].join("\n");

  try {
    const modelResult = await callEvaluationModel(prompt);
    const normalizedResult = normalizeModelEvaluation(modelResult);
    const parsed = EvaluationSchema.safeParse(normalizedResult);

    if (!parsed.success) {
      console.error("EVALUATION_SCHEMA_VALIDATION_FAILED", parsed.error.flatten());
      throw new Error("EVALUATION_FAILED");
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof Error && error.message === "EVALUATION_FAILED") {
      throw error;
    }
    console.error("EVALUATION_MODEL_CALL_FAILED", error);
    throw new Error("EVALUATION_FAILED");
  }
}
