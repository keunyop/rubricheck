import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAssignment } from "../../../lib/evaluation";
import { buildFinalEvaluation, type FeedbackAccessTier } from "../../../lib/gradeFinalization";
import { FileParseValidationError, parseFile } from "../../../lib/parse";
import { hashNormalizedEmail, structureRubric } from "../../../lib/rubricStructuring";
import { GradingModeSchema, type GradingMode } from "../../../lib/schema";
import { createRequestContext, errorResponse } from "../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import { resolveCreditStorageTarget } from "../../../src/lib/credits";
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

function getUploadedFile(formData: FormData, fieldName: FieldName): File | null {
  const value = formData.get(fieldName);
  if (!(value instanceof File)) {
    return null;
  }
  return value;
}

function getTextInput(formData: FormData, fieldName: "rubricText" | "assignmentText"): string | null {
  const value = formData.get(fieldName);
  if (typeof value !== "string") {
    return null;
  }
  return value.trim().length > 0 ? value : null;
}

function validateFileSize(file: File, fieldName: FieldName): { field: FieldName } | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { field: fieldName };
  }
  return null;
}

async function resolveFieldText(field: FieldName, textValue: string | null, file: File | null): Promise<string> {
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
      throw new Error(`FILE_PARSE_FAILED:${field}`);
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_FILE_TYPE") {
      throw new Error(`UNSUPPORTED_FILE_TYPE:${field}`);
    }

    throw error;
  }
}

function readCustomerIdFromRequest(request: Request): string | null {
  const headerValue = request.headers.get("x-stripe-customer-id")?.trim() ?? "";
  return headerValue ? headerValue : null;
}

async function resolveRubricCacheIdentity(
  request: Request,
): Promise<{ userIdType: "customer" | "emailhash"; userIdValue: string } | null> {
  const customerIdFromRequest = readCustomerIdFromRequest(request);
  if (customerIdFromRequest) {
    return {
      userIdType: "customer",
      userIdValue: customerIdFromRequest,
    };
  }

  const creditEmail = getCreditEmailFromCookie(request);
  const email = creditEmail;
  if (!email) {
    return null;
  }

  const target = await resolveCreditStorageTarget({ email });
  if (target?.type === "customer") {
    return {
      userIdType: "customer",
      userIdValue: target.customerId,
    };
  }

  return {
    userIdType: "emailhash",
    userIdValue: hashNormalizedEmail(email),
  };
}

export async function POST(request: Request) {
  const context = createRequestContext(request);

  try {
    const signedInEmail = getCreditEmailFromCookie(request);
    if (!signedInEmail) {
      return errorResponse(context, 401, "AUTH_REQUIRED", "Log in before requesting an evaluation.");
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
        return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
      }

      const parsedRequest = JsonGradeRequestSchema.safeParse(payload);
      if (!parsedRequest.success) {
        return errorResponse(context, 400, "INVALID_INPUT", "Please provide valid rubric and assignment inputs.", parsedRequest.error.flatten());
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
        return errorResponse(context, 400, "INVALID_MODE", "Invalid grading mode. Select Standard or Strict mode.");
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
        return errorResponse(context, 400, "FILE_TOO_LARGE", "Rubric file is too large. Max size is 5MB.", rubricSizeError);
      }
    }

    if (assignmentFile) {
      const assignmentSizeError = validateFileSize(assignmentFile, "assignment");
      if (assignmentSizeError) {
        return errorResponse(context, 400, "FILE_TOO_LARGE", "Assignment file is too large. Max size is 5MB.", assignmentSizeError);
      }
    }

    if (!rubricTextInput && !rubricFile) {
      return errorResponse(context, 400, "MISSING_INPUT", "Please provide both a rubric and an assignment.");
    }

    if (!assignmentTextInput && !assignmentFile) {
      return errorResponse(context, 400, "MISSING_INPUT", "Please provide both a rubric and an assignment.");
    }

    const [rubricText, assignmentText] = await Promise.all([
      resolveFieldText("rubric", rubricTextInput, rubricFile),
      resolveFieldText("assignment", assignmentTextInput, assignmentFile),
    ]);

    const usage = await checkUsageLimit(request, "evaluate");
    const usageHeaders = buildUsageLimitHeaders(usage);
    if (usage.degradedCode === "REDIS_UNAVAILABLE") {
      usageHeaders["x-rubricheck-warning"] = "REDIS_UNAVAILABLE";
    }

    const feedbackTier: FeedbackAccessTier = usage.billingSource === "pro" ? "pro" : "free";

    if (!usage.allowed) {
      if (usage.errorCode === "FREE_LIMIT_REACHED" && usage.action === "SHOW_INTERSTITIAL") {
        return NextResponse.json(buildFreeLimitReachedPayload(usage.limit), {
          status: 429,
          headers: usageHeaders,
        });
      }

      if (usage.errorCode === "REDIS_UNAVAILABLE") {
        return errorResponse(context, 503, "REDIS_UNAVAILABLE", usage.errorMessage ?? "Usage checks are temporarily unavailable. Please retry shortly.", undefined, usageHeaders);
      }

      if (usage.errorCode === "FREE_USAGE_STORE_UNAVAILABLE") {
        return errorResponse(
          context,
          503,
          "SERVICE_UNAVAILABLE",
          usage.errorMessage ?? "Free evaluation tracking is temporarily unavailable. Please retry shortly.",
          undefined,
          usageHeaders,
        );
      }

      return errorResponse(context, 429, usage.errorCode ?? "RATE_LIMITED", usage.errorMessage ?? `Free trial limit reached (${usage.limit}). Upgrade to continue.`, undefined, usageHeaders);
    }

    let structuredRubric;
    try {
      const cacheIdentity = await resolveRubricCacheIdentity(request);
      structuredRubric = await structureRubric(rubricText, {
        cacheIdentity,
        requestId: context.requestId,
      });
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
          console.error("CREDIT_RESERVATION_REFUND_FAILED", { requestId: context.requestId, refundError });
        }
      }

      if (error instanceof Error && error.message === "OPENAI_TIMEOUT") {
        return errorResponse(
          context,
          504,
          "OPENAI_TIMEOUT",
          "Our AI reviewer is taking longer than usual. Please retry in a moment.",
        );
      }
      console.error("RUBRIC_STRUCTURE_FAILED", { requestId: context.requestId, error });
      return errorResponse(context, 400, "RUBRIC_STRUCTURE_FAILED", "We could not read the rubric format. Please revise and retry.");
    }

    try {
      const evaluation = await evaluateAssignment(structuredRubric, assignmentText, mode, {
        detailLevel: feedbackTier === "pro" ? "detailed" : "diagnostic",
      });
      const finalEvaluation = buildFinalEvaluation(structuredRubric, evaluation, mode, feedbackTier);
      const headers = new Headers(usageHeaders);
      headers.set("x-request-id", context.requestId);
      return NextResponse.json(finalEvaluation, { headers });
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
          console.error("CREDIT_RESERVATION_REFUND_FAILED", { requestId: context.requestId, refundError });
        }
      }

      if (error instanceof Error && error.message === "OPENAI_TIMEOUT") {
        return errorResponse(
          context,
          504,
          "OPENAI_TIMEOUT",
          "Our AI reviewer is taking longer than usual. Please retry in a moment.",
          undefined,
          usageHeaders,
        );
      }

      console.error("EVALUATION_FAILED", { requestId: context.requestId, error });
      return errorResponse(context, 500, "EVALUATION_FAILED", "We hit an unexpected error while grading. Please retry.", undefined, usageHeaders);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING") {
      return errorResponse(context, 503, "REDIS_UNAVAILABLE", "Usage verification is temporarily unavailable. Please retry shortly.");
    }

    if (error instanceof Error && error.message === "MISSING_INPUT") {
      return errorResponse(context, 400, "MISSING_INPUT", "Please provide both a rubric and an assignment.");
    }

    if (error instanceof Error && error.message.startsWith("UNSUPPORTED_FILE_TYPE:")) {
      const field = error.message.split(":")[1] as FieldName;
      return errorResponse(context, 400, "UNSUPPORTED_FILE_TYPE", "Unsupported file type. Upload PDF, DOCX, or TXT.", { field });
    }

    if (error instanceof Error && error.message.startsWith("FILE_PARSE_FAILED:")) {
      const field = error.message.split(":")[1] as FieldName;
      return errorResponse(context, 400, "FILE_PARSE_FAILED", "We couldn't extract enough text from that file. Try again, upload another format, or paste text.", {
        field,
        hint: "If this is a scanned PDF, OCR may be required before upload.",
      });
    }

    if (error instanceof FileParseValidationError) {
      return errorResponse(context, 400, "FILE_PARSE_FAILED", "We couldn't parse the uploaded file. Try another format or paste text.", {
        parseError: error.message,
      });
    }

    return errorResponse(context, 500, "INTERNAL_SERVER_ERROR", "Failed to process uploaded files.");
  }
}
