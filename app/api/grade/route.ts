import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAssignment } from "../../../lib/evaluation";
import { buildFinalEvaluation, type FeedbackAccessTier } from "../../../lib/gradeFinalization";
import { FileParseValidationError, parseFile } from "../../../lib/parse";
import { structureRubric } from "../../../lib/rubricStructuring";
import { GradingModeSchema, type GradingMode } from "../../../lib/schema";
import { shouldRefundReservedEvaluateCredit } from "../../../src/lib/evaluationCreditSettlement";
import { buildFreeLimitReachedPayload } from "../../../src/lib/evaluateLimitPayload";
import {
  buildUsageLimitHeaders,
  checkUsageLimit,
  refundUsageCreditReservation,
} from "../../../src/lib/usageLimit";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const GradeRequestSchema = z.object({
  mode: GradingModeSchema.default("standard"),
});
const JsonGradeRequestSchema = z.object({
  mode: GradingModeSchema.default("standard"),
  rubricText: z.string().trim().min(1),
  assignmentText: z.string().trim().min(1),
});

type FieldName = "rubric" | "assignment";

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

export async function POST(request: Request) {
  try {
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
        return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
      }

      const parsedRequest = JsonGradeRequestSchema.safeParse(payload);
      if (!parsedRequest.success) {
        return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
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
        return NextResponse.json({ error: "INVALID_MODE" }, { status: 400 });
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

    const usage = await checkUsageLimit(request, "evaluate");
    const usageHeaders = buildUsageLimitHeaders(usage);
    const feedbackTier: FeedbackAccessTier = usage.billingSource === "pro" ? "pro" : "free";

    if (!usage.allowed) {
      if (usage.errorCode === "FREE_LIMIT_REACHED" && usage.action === "SHOW_INTERSTITIAL") {
        return NextResponse.json(buildFreeLimitReachedPayload(usage.limit), {
          status: 429,
          headers: usageHeaders,
        });
      }

      return NextResponse.json(
        {
          error: usage.errorCode ?? usage.errorMessage ?? `Free daily limit reached (${usage.limit}). Upgrade to continue.`,
          message: usage.errorMessage,
        },
        { status: 429, headers: usageHeaders },
      );
    }

    try {
      const evaluation = await evaluateAssignment(structuredRubric, assignmentText, mode);
      const finalEvaluation = buildFinalEvaluation(structuredRubric, evaluation, mode, feedbackTier);
      return NextResponse.json(finalEvaluation, { headers: usageHeaders });
    } catch (error) {
      if (
        shouldRefundReservedEvaluateCredit({
          billingSource: usage.billingSource,
          hasReservation: Boolean(usage.creditReservation),
          evaluationSucceeded: false,
        })
      ) {
        try {
          await refundUsageCreditReservation(usage);
        } catch (refundError) {
          console.error("CREDIT_RESERVATION_REFUND_FAILED", refundError);
        }
      }
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
