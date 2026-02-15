import { NextResponse } from "next/server";

import { evaluateAssignment } from "../../../lib/evaluation";
import { FileParseValidationError, parseFile } from "../../../lib/parse";
import { structureRubric } from "../../../lib/rubricStructuring";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
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

    return {
      name: rubricCriterion.name,
      max_score: rubricCriterion.max_score,
      estimated_range: estimatedRange,
      feedback: matchedScore.feedback,
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
    const formData = await request.formData();

    const rubricFile = getUploadedFile(formData, "rubric");
    const assignmentFile = getUploadedFile(formData, "assignment");
    const rubricTextInput = getTextInput(formData, "rubricText");
    const assignmentTextInput = getTextInput(formData, "assignmentText");

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

    const rubricText = await resolveFieldText("rubric", rubricTextInput, rubricFile);
    const assignmentText = await resolveFieldText(
      "assignment",
      assignmentTextInput,
      assignmentFile,
    );

    let structuredRubric;
    try {
      structuredRubric = await structureRubric(rubricText);
    } catch (error) {
      console.error("RUBRIC_STRUCTURE_FAILED", error);
      return NextResponse.json({ error: "RUBRIC_STRUCTURE_FAILED" }, { status: 400 });
    }

    try {
      const evaluation = await evaluateAssignment(structuredRubric, assignmentText);
      const finalEvaluation = buildFinalEvaluation(structuredRubric, evaluation);
      return NextResponse.json(finalEvaluation);
    } catch (error) {
      console.error("EVALUATION_FAILED", error);
      return NextResponse.json({ error: "EVALUATION_FAILED" }, { status: 500 });
    }
  } catch (error) {
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
