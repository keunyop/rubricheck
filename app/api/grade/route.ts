import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAssignment } from "../../../lib/evaluation";
import { FileParseValidationError, parseFile } from "../../../lib/parse";
import { structureRubric } from "../../../lib/rubricStructuring";
import { GradingModeSchema, type GradingMode } from "../../../lib/schema";
import { buildUsageLimitHeaders, checkUsageLimit } from "../../../src/lib/usageLimit";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const STRICT_OVERALL_PENALTY = 3;
const GradeRequestSchema = z.object({
  mode: GradingModeSchema.default("standard"),
});
const JsonGradeRequestSchema = z.object({
  mode: GradingModeSchema.default("standard"),
  rubricText: z.string().trim().min(1),
  assignmentText: z.string().trim().min(1),
});

type FieldName = "rubric" | "assignment";
type StructuredRubric = Awaited<ReturnType<typeof structureRubric>>;
type Evaluation = Awaited<ReturnType<typeof evaluateAssignment>>;

function getUploadedFile(
  formData: FormData,
  fieldName: FieldName,
): File | null {
  const value = formData.get(fieldName);

  if (!(value instanceof File)) {
    return null;
  }

  return value;
}

function getTextInput(
  formData: FormData,
  fieldName: "rubricText" | "assignmentText",
): string | null {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return null;
  }

  if (value.trim().length === 0) {
    return null;
  }

  return value;
}

function validateFileSize(
  file: File,
  fieldName: FieldName,
): NextResponse | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", field: fieldName }, { status: 400 });
  }

  return null;
}

async function resolveFieldText(
  field: FieldName,
  textValue: string | null,
  file: File | null,
): Promise<string> {
  if (textValue !== null) {
    return textValue;
  }

  if (!file) {
    throw new Error("MISSING_INPUT");
  }

  try {
    return await parseFile(file);
  } catch (error) {
    if (error instanceof Error && error.message === "TEXT_EXTRACTION_FAILED") {
      throw new Error(`TEXT_EXTRACTION_FAILED:${field}`);
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_FILE_TYPE") {
      throw new Error(`UNSUPPORTED_FILE_TYPE:${field}`);
    }

    throw error;
  }
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

function buildFinalEvaluation(
  structuredRubric: StructuredRubric,
  evaluation: Evaluation,
  mode: GradingMode,
) {
  const rubricCriteria = structuredRubric.criteria;
  const scoreByName = new Map<string, Evaluation["criteria_scores"][number]>();
  const rubricNameSet = new Set<string>();

  for (const score of evaluation.criteria_scores) {
    const key = normalizeCriterionName(score.name);
    if (!key || scoreByName.has(key)) {
      throw new Error("EVALUATION_FAILED");
    }
    scoreByName.set(key, score);
  }

  const criteria = rubricCriteria.map((rubricCriterion) => {
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
    const rationale = matchedScore.rationale;
    const feedback = matchedScore.feedback;
    const evidence = matchedScore.evidence?.slice(0, 2);

    if (mode === "strict" && (!evidence || evidence.length < 1 || evidence.length > 2)) {
      throw new Error("EVALUATION_FAILED");
    }

    return {
      name: rubricCriterion.name,
      max_score: rubricCriterion.max_score,
      score,
      rationale,
      estimated_range: estimatedRange,
      feedback,
      ...(evidence ? { evidence } : {}),
    };
  });

  if (criteria.length !== evaluation.criteria_scores.length) {
    throw new Error("EVALUATION_FAILED");
  }

  const overallRawLow = criteria.reduce((sum, criterion) => sum + criterion.estimated_range[0], 0);
  const overallRawHigh = criteria.reduce((sum, criterion) => sum + criterion.estimated_range[1], 0);
  const rubricTotal = rubricCriteria.reduce((sum, criterion) => sum + criterion.max_score, 0);

  if (!Number.isFinite(rubricTotal) || rubricTotal <= 0) {
    throw new Error("EVALUATION_FAILED");
  }

  let scaledLow = clamp(Math.round((overallRawLow / rubricTotal) * 100), 0, 100);
  let scaledHigh = clamp(Math.round((overallRawHigh / rubricTotal) * 100), 0, 100);

  if (mode === "strict") {
    scaledLow = clamp(scaledLow - STRICT_OVERALL_PENALTY, 0, 100);
    scaledHigh = clamp(scaledHigh - STRICT_OVERALL_PENALTY, 0, 100);
  }

  if (scaledLow > scaledHigh) {
    [scaledLow, scaledHigh] = [scaledHigh, scaledLow];
  }

  if (scaledHigh - scaledLow > 25) {
    const center = Math.round((scaledLow + scaledHigh) / 2);
    scaledLow = Math.max(0, center - 12);
    scaledHigh = Math.min(100, scaledLow + 25);
    if (scaledLow > scaledHigh) {
      scaledLow = scaledHigh;
    }
  }

  if (evaluation.top_improvements.length < 3) {
    throw new Error("EVALUATION_FAILED");
  }

  const topImprovements = evaluation.top_improvements.slice(0, 3);

  return {
    title: "Evaluation Summary",
    overall_range: [scaledLow, scaledHigh] as [number, number],
    summary: evaluation.summary,
    top_improvements: topImprovements,
    criteria,
  };
}

export async function POST(request: Request) {
  try {
    const usage = await checkUsageLimit(request, "evaluate");
    const usageHeaders = buildUsageLimitHeaders(usage);

    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.errorMessage ?? `Free daily limit reached (${usage.limit}). Upgrade to continue.` },
        { status: 429, headers: usageHeaders },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let mode: GradingMode = "standard";
    let rubricFile: File | null = null;
    let assignmentFile: File | null = null;
    let rubricTextInput: string | null = null;
    let assignmentTextInput: string | null = null;

    if (contentType.includes("application/json")) {
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: usageHeaders });
      }

      const parsedRequest = JsonGradeRequestSchema.safeParse(payload);
      if (!parsedRequest.success) {
        return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400, headers: usageHeaders });
      }

      mode = parsedRequest.data.mode;
      rubricTextInput = parsedRequest.data.rubricText;
      assignmentTextInput = parsedRequest.data.assignmentText;
    } else {
      const formData = await request.formData();
      const modeInput = formData.get("mode");
      const parsedRequest = GradeRequestSchema.safeParse({
        mode: typeof modeInput === "string" ? modeInput : undefined,
      });

      if (!parsedRequest.success) {
        return NextResponse.json({ error: "INVALID_MODE" }, { status: 400, headers: usageHeaders });
      }

      mode = parsedRequest.data.mode;
      rubricFile = getUploadedFile(formData, "rubric");
      assignmentFile = getUploadedFile(formData, "assignment");
      rubricTextInput = getTextInput(formData, "rubricText");
      assignmentTextInput = getTextInput(formData, "assignmentText");
    }

    if (rubricFile) {
      const rubricSizeError = validateFileSize(rubricFile, "rubric");
      if (rubricSizeError) {
        return rubricSizeError;
      }
    }

    if (assignmentFile) {
      const assignmentSizeError = validateFileSize(assignmentFile, "assignment");
      if (assignmentSizeError) {
        return assignmentSizeError;
      }
    }

    if (!rubricTextInput && !rubricFile) {
      return NextResponse.json({ error: "MISSING_INPUT" }, { status: 400 });
    }

    if (!assignmentTextInput && !assignmentFile) {
      return NextResponse.json({ error: "MISSING_INPUT" }, { status: 400 });
    }

    const [rubricText, assignmentText] = await Promise.all([
      resolveFieldText("rubric", rubricTextInput, rubricFile),
      resolveFieldText("assignment", assignmentTextInput, assignmentFile),
    ]);

    let structuredRubric;
    try {
      structuredRubric = await structureRubric(rubricText);
    } catch (error) {
      console.error("RUBRIC_STRUCTURE_FAILED", error);
      return NextResponse.json({ error: "RUBRIC_STRUCTURE_FAILED" }, { status: 400 });
    }

    try {
      const evaluation = await evaluateAssignment(structuredRubric, assignmentText, mode);
      const finalEvaluation = buildFinalEvaluation(structuredRubric, evaluation, mode);
      return NextResponse.json(finalEvaluation, { headers: usageHeaders });
    } catch (error) {
      console.error("EVALUATION_FAILED", error);
      return NextResponse.json({ error: "EVALUATION_FAILED" }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING") {
      console.error("RATE_LIMIT_CONFIG_MISSING");
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    if (error instanceof Error && error.message === "MISSING_INPUT") {
      return NextResponse.json({ error: "MISSING_INPUT" }, { status: 400 });
    }

    if (error instanceof Error && error.message.startsWith("UNSUPPORTED_FILE_TYPE:")) {
      const field = error.message.split(":")[1] as FieldName;
      return NextResponse.json({ error: "UNSUPPORTED_FILE_TYPE", field }, { status: 400 });
    }

    if (error instanceof Error && error.message.startsWith("TEXT_EXTRACTION_FAILED:")) {
      const field = error.message.split(":")[1] as FieldName;
      return NextResponse.json({ error: "TEXT_EXTRACTION_FAILED", field }, { status: 400 });
    }

    if (error instanceof FileParseValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to process uploaded files" }, { status: 500 });
  }
}
