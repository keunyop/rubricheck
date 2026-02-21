import { callEvaluationModel } from "./openai";
import {
  EvaluationSchema,
  GradingModeSchema,
  StrictEvaluationSchema,
  type Evaluation,
  type GradingMode,
  type Rubric,
} from "./schema";

const STRICT_JSON_SYSTEM_INSTRUCTION = [
  "Return a single valid JSON object only.",
  "Do not include markdown, code fences, or extra text.",
  "Use a firm, academic, concise tone.",
  "Apply strict and conservative grading with no benefit of doubt.",
].join(" ");

function sanitizeSingleLine(value: string, maxLength: number): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

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
    .map((item) => sanitizeSingleLine(item, 120))
    .filter((item) => item.length > 0)
    .slice(0, 3);

  return normalized;
}

function normalizeEvidence(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeSingleLine(item, 220))
    .filter((item) => item.length > 0)
    .slice(0, 2);

  return normalized.length > 0 ? normalized : undefined;
}

function toRoundedInteger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric);
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

    const low = toRoundedInteger(estimated[0]);
    const high = toRoundedInteger(estimated[1]);
    const scoreFromRange = low !== null && high !== null ? Math.round((low + high) / 2) : null;
    const score = toRoundedInteger(row.score) ?? scoreFromRange;

    const rationaleRaw =
      typeof row.rationale === "string"
        ? row.rationale
        : typeof row.feedback === "string"
          ? row.feedback
          : null;

    const feedbackRaw =
      typeof row.feedback === "string"
        ? row.feedback
        : typeof row.rationale === "string"
          ? row.rationale
          : null;

    const estimatedRange =
      low !== null && high !== null
        ? [low, high]
        : score !== null
          ? [score, score]
          : row.estimated_range;

    const evidence = normalizeEvidence(row.evidence);

    return {
      ...row,
      score: score ?? row.score,
      rationale: rationaleRaw === null ? row.rationale : sanitizeSingleLine(rationaleRaw, 140),
      feedback: feedbackRaw === null ? row.feedback : sanitizeSingleLine(feedbackRaw, 140),
      estimated_range: estimatedRange,
      ...(evidence ? { evidence } : {}),
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

function buildEvaluationPrompt(rubric: Rubric, assignmentText: string, mode: GradingMode): string {
  const criteriaForScoring = rubric.criteria.map((criterion) => ({
    name: criterion.name,
    max_score: criterion.max_score,
    description: criterion.description,
  }));
  const schemaDescription =
    mode === "strict"
      ? `{
  "summary": "string",
  "criteria_scores": [
    {
      "name": "string",
      "score": integer,
      "rationale": "string",
      "estimated_range": [integer, integer],
      "feedback": "string",
      "evidence": ["string", "string"]
    }
  ],
  "top_improvements": ["string", "string", "string"]
}`
      : `{
  "summary": "string",
  "criteria_scores": [
    {
      "name": "string",
      "score": integer,
      "rationale": "string",
      "estimated_range": [integer, integer],
      "feedback": "string",
      "evidence": ["string"]
    }
  ],
  "top_improvements": ["string", "string", "string"]
}`;

  const rules =
    mode === "strict"
      ? [
          "- Be conservative. Do not give benefit of doubt when evidence is missing or unclear.",
          "- Include one criteria_scores item per rubric criterion.",
          "- Use the rubric criterion names exactly as given and keep the same order.",
          "- Use rubric wording explicitly. Do not invent criteria.",
          "- For each criterion, provide evidence with 1-2 short direct quotes/snippets from the assignment.",
          "- evidence is required and must contain 1-2 items per criterion.",
          "- If evidence is weak/missing, cap score and estimated_range high at <= 60% of criterion max_score.",
          "- Penalize omissions of required content, structure, or format more strongly.",
          "- score and estimated_range must be integers and align with each other.",
          "- estimated_range must be [low, high] with low <= high.",
          "- rationale and feedback must be one line, <= 140 chars, firm and academic.",
          "- summary must be 1-2 sentences, <= 280 chars, concise and academic.",
          "- top_improvements must contain exactly 3 items, each <= 120 chars.",
          "- Do not include numbering prefixes in top_improvements.",
          "- No markdown. No extra keys. No extra text.",
        ]
      : [
          "- Include one criteria_scores item per rubric criterion.",
          "- Use the rubric criterion names exactly as given.",
          "- Keep criteria_scores in the same order as rubric criteria.",
          "- score and estimated_range must be integers and align with each other.",
          "- estimated_range must be [low, high] integers with low <= high.",
          "- Keep each range width modest; target width <= 20% of that criterion max_score.",
          "- rationale and feedback must be one line, <= 140 chars, and neutral in tone.",
          "- summary must be 1-2 sentences, <= 280 chars, and neutral in tone.",
          "- top_improvements must contain exactly 3 items, each <= 120 chars.",
          "- evidence is optional in standard mode; omit it if not useful.",
          "- Do not include numbering prefixes in top_improvements.",
          "- No markdown. No extra keys. No extra text.",
        ];

  return [
    "Evaluate the assignment using the provided rubric.",
    "Return JSON only, matching this schema exactly:",
    schemaDescription,
    "Rules:",
    ...rules,
    "",
    "Rubric criteria (use these names exactly):",
    JSON.stringify(criteriaForScoring),
    "",
    "Assignment text:",
    assignmentText,
  ].join("\n");
}

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
): Promise<Evaluation> {
  const prompt = buildEvaluationPrompt(rubric, assignmentText, mode);

  try {
    const modelResult =
      mode === "strict"
        ? await callEvaluationModel(prompt, { systemInstruction: STRICT_JSON_SYSTEM_INSTRUCTION })
        : await callEvaluationModel(prompt);
    const normalizedResult = normalizeModelEvaluation(modelResult);
    return parseEvaluationByMode(mode, normalizedResult);
  } catch (error) {
    if (error instanceof Error && error.message === "EVALUATION_FAILED") {
      throw error;
    }
    console.error("EVALUATION_MODEL_CALL_FAILED", error);
    throw new Error("EVALUATION_FAILED");
  }
}
