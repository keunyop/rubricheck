import { NextResponse } from "next/server";
import { z } from "zod";

import { callEvaluationModel } from "../../../lib/openai";
import { createRequestContext, errorResponse } from "../../../src/lib/apiError";
import { buildUsageLimitHeaders, checkUsageLimit } from "../../../src/lib/usageLimit";

const MAX_ACCEPTED_TEXT_LENGTH = 200_000;
const MAX_PROMPT_RUBRIC_LENGTH = 12_000;
const MAX_PROMPT_ASSIGNMENT_LENGTH = 16_000;
const MAX_PROMPT_CRITERIA_NAME_LENGTH = 180;
const MAX_PROMPT_FEEDBACK_LENGTH = 800;
const MAX_NOTES_LENGTH = 500;

const RewriteRequestSchema = z.object({
  rubricText: z.string().trim().min(1).max(MAX_ACCEPTED_TEXT_LENGTH),
  assignmentText: z.string().trim().min(1).max(MAX_ACCEPTED_TEXT_LENGTH),
  criteriaId: z.string().trim().min(1).max(120),
  criteriaName: z.string().trim().min(1).max(200),
  criteriaFeedback: z.string().trim().min(1).max(2_000),
  targetLevel: z.enum(["A", "90+", "maximize"]),
});

const RewriteExampleSchema = z.object({
  title: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(1_400),
});

const ModelRewriteResponseSchema = z.object({
  strategy: z.string().trim().min(1).max(800),
  rewrite_examples: z.array(RewriteExampleSchema).min(1).max(3),
  notes: z.string().trim().min(1).max(MAX_NOTES_LENGTH),
});

type TruncateResult = { text: string; truncated: boolean };

function truncateByCodePoint(value: string, maxLength: number): TruncateResult {
  const codePoints = Array.from(value);
  if (codePoints.length <= maxLength) {
    return { text: value, truncated: false };
  }

  return { text: codePoints.slice(0, maxLength).join(""), truncated: true };
}

function appendTruncationNotes(notes: string, flags: { rubricTruncated: boolean; assignmentTruncated: boolean; feedbackTruncated: boolean }): string {
  const suffixes: string[] = [];
  if (flags.rubricTruncated) suffixes.push("Rubric text was truncated for length.");
  if (flags.assignmentTruncated) suffixes.push("Assignment text was truncated for length.");
  if (flags.feedbackTruncated) suffixes.push("Criteria feedback was truncated for length.");
  if (suffixes.length === 0) return notes;
  return truncateByCodePoint(`${notes} ${suffixes.join(" ")}`.trim(), MAX_NOTES_LENGTH).text;
}

function buildRewritePrompt(input: {
  rubricText: string;
  assignmentText: string;
  criteriaId: string;
  criteriaName: string;
  criteriaFeedback: string;
  targetLevel: "A" | "90+" | "maximize";
}): string {
  return [
    "You are improving one rubric criterion for a student's assignment.",
    "Return JSON with this exact shape:",
    `{\n  "strategy": "string",\n  "rewrite_examples": [{ "title": "string", "text": "string" }],\n  "notes": "string"\n}`,
    "Rules:",
    "- strategy: concise action steps specific to this criterion.",
    "- rewrite_examples: 1 to 3 improved paragraph examples the student can adapt.",
    "- Keep examples self-contained and directly usable.",
    "- Preserve likely intent; do not invent citations or fake facts.",
    "- notes: short cautions/assumptions.",
    "- No markdown. No extra keys. No extra text.",
    "",
    `Target level: ${input.targetLevel}`,
    `Criteria ID: ${input.criteriaId}`,
    `Criteria name: ${input.criteriaName}`,
    `Criteria feedback: ${input.criteriaFeedback}`,
    "",
    "Rubric text:",
    input.rubricText,
    "",
    "Assignment text:",
    input.assignmentText,
  ].join("\n");
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const usage = await checkUsageLimit(request, "rewrite");
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

  const parsedInput = RewriteRequestSchema.safeParse(payload);
  if (!parsedInput.success) {
    return errorResponse(context, 400, "INVALID_INPUT", "Please provide valid rewrite inputs.", parsedInput.error.flatten(), usageHeaders);
  }

  const rubricResult = truncateByCodePoint(parsedInput.data.rubricText, MAX_PROMPT_RUBRIC_LENGTH);
  const assignmentResult = truncateByCodePoint(parsedInput.data.assignmentText, MAX_PROMPT_ASSIGNMENT_LENGTH);
  const criteriaNameResult = truncateByCodePoint(parsedInput.data.criteriaName, MAX_PROMPT_CRITERIA_NAME_LENGTH);
  const feedbackResult = truncateByCodePoint(parsedInput.data.criteriaFeedback, MAX_PROMPT_FEEDBACK_LENGTH);

  const prompt = buildRewritePrompt({
    rubricText: rubricResult.text,
    assignmentText: assignmentResult.text,
    criteriaId: parsedInput.data.criteriaId,
    criteriaName: criteriaNameResult.text,
    criteriaFeedback: feedbackResult.text,
    targetLevel: parsedInput.data.targetLevel,
  });

  try {
    const rawModelResponse = await callEvaluationModel(prompt);
    const parsedModelResponse = ModelRewriteResponseSchema.safeParse(rawModelResponse);
    if (!parsedModelResponse.success) {
      return errorResponse(context, 502, "REWRITE_OUTPUT_INVALID", "The rewrite response was invalid. Please retry.", undefined, usageHeaders);
    }

    const headers = new Headers(usageHeaders);
    headers.set("x-request-id", context.requestId);
    return NextResponse.json({
      criteriaId: parsedInput.data.criteriaId,
      strategy: parsedModelResponse.data.strategy,
      rewrite_examples: parsedModelResponse.data.rewrite_examples,
      notes: appendTruncationNotes(parsedModelResponse.data.notes, {
        rubricTruncated: rubricResult.truncated,
        assignmentTruncated: assignmentResult.truncated,
        feedbackTruncated: feedbackResult.truncated,
      }),
    }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "OPENAI_TIMEOUT") {
      return errorResponse(context, 504, "OPENAI_TIMEOUT", "Our AI reviewer is taking longer than usual. Please retry in a moment.", undefined, usageHeaders);
    }

    return errorResponse(context, 502, "REWRITE_FAILED", "Unable to generate rewrite suggestions right now.", undefined, usageHeaders);
  }
}
