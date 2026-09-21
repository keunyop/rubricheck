import { createHash, randomUUID } from "node:crypto";
import { generalRubric, ASSIGNMENT_INSTRUCTIONS_LIMIT } from "../../../lib/generalRubric";
import { editSavedRubric, getSavedRubric, saveRubric, validRubricId } from "../../../src/lib/rubricLibrary";
import { trialIdentity, reserveTrial, releaseTrial, completeTrial, setTrialCookie, TRIAL_TEXT_LIMIT, type TrialReservation } from "../../../src/lib/guestTrial";
import { saveEvaluation } from "../../../src/lib/evaluationRecovery";
import { archiveAssignment, getProject } from "../../../src/lib/assignmentWorkspace";
import { assignmentTitle } from "../../../src/lib/assignmentWorkspaceTypes";
import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateAssignment } from "../../../lib/evaluation";
import { buildFinalEvaluation, type FeedbackAccessTier } from "../../../lib/gradeFinalization";
import { detectHiddenAiAlert } from "../../../lib/hiddenAiAlert";
import { FileParseValidationError, parseFile } from "../../../lib/parse";
import { hashNormalizedEmail, structureRubric } from "../../../lib/rubricStructuring";
import { GradingModeSchema, type GradingMode } from "../../../lib/schema";
import { createRequestContext, errorResponse } from "../../../src/lib/apiError";
import { canUseStrictMode, resolveAccountFeatureTier } from "../../../src/lib/accountFeatureAccess";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import { getCreditBalanceForRequest, resolveCreditStorageTarget } from "../../../src/lib/credits";
import { buildFreeLimitReachedPayload } from "../../../src/lib/evaluateLimitPayload";
import {
  buildUsageLimitHeaders,
  checkUsageLimit,
  settleUsageReservation,
  type UsageCheckResult,
} from "../../../src/lib/usageLimit";
import {
  getAccountEntitlementByEmail,
  hasAccountEntitlementStore,
  isActiveProAccountEntitlement,
} from "../../../src/lib/accountEntitlements";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_FIELD_UPLOAD_BYTES = 30 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);
const GradeRequestSchema = z.object({
  mode: GradingModeSchema.default("standard"),
  rubricSource: z.enum(["provided", "general", "saved"]).default("provided"),
  rubricId: z.string().refine(validRubricId).optional(),
  assignmentInstructions: z.string().trim().max(ASSIGNMENT_INSTRUCTIONS_LIMIT).default(""),
});
const JsonGradeRequestSchema = GradeRequestSchema.extend({
  rubricText: z.string().trim().optional(),
  assignmentText: z.string().trim().min(1),
}).refine(data => data.rubricSource !== "provided" || Boolean(data.rubricText));

type FieldName = "rubric" | "assignment";

type UploadedFileValidationResult =
  | { code: "FILE_TOO_LARGE"; field: FieldName }
  | { code: "FILE_TOTAL_TOO_LARGE"; field: FieldName }
  | { code: "MULTI_FILE_IMAGES_ONLY"; field: FieldName };

function getUploadedFiles(formData: FormData, fieldName: FieldName): File[] {
  return formData.getAll(fieldName).filter((value): value is File => value instanceof File && value.size > 0);
}

function getTextInput(formData: FormData, fieldName: "rubricText" | "assignmentText"): string | null {
  const value = formData.get(fieldName);
  if (typeof value !== "string") {
    return null;
  }
  return value.trim().length > 0 ? value : null;
}

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function isImageFile(file: File): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(file.name));
}

function validateUploadedFiles(files: File[], fieldName: FieldName): UploadedFileValidationResult | null {
  if (files.some((file) => file.size > MAX_FILE_SIZE_BYTES)) {
    return { code: "FILE_TOO_LARGE", field: fieldName };
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_FIELD_UPLOAD_BYTES) {
    return { code: "FILE_TOTAL_TOO_LARGE", field: fieldName };
  }

  if (files.length > 1 && !files.every((file) => isImageFile(file))) {
    return { code: "MULTI_FILE_IMAGES_ONLY", field: fieldName };
  }

  return null;
}

function mapFieldParseError(error: unknown, field: FieldName): never {
  if (error instanceof Error && error.message === "TEXT_EXTRACTION_FAILED") {
    throw new Error(`FILE_PARSE_FAILED:${field}`);
  }

  if (error instanceof Error && error.message === "UNSUPPORTED_FILE_TYPE") {
    throw new Error(`UNSUPPORTED_FILE_TYPE:${field}`);
  }

  if (error instanceof Error && error.message === "GOOGLE_VISION_OCR_UNAVAILABLE") {
    throw new Error(`OCR_UNAVAILABLE:${field}`);
  }

  throw error;
}

async function resolveFieldText(field: FieldName, textValue: string | null, files: File[]): Promise<string> {
  if (textValue !== null) {
    return textValue;
  }

  if (files.length === 0) {
    throw new Error("MISSING_INPUT");
  }

  if (files.length > 1) {
    if (!files.every((file) => isImageFile(file))) {
      throw new Error(`MULTI_FILE_IMAGES_ONLY:${field}`);
    }

    const chunks: string[] = [];
    for (const file of files) {
      try {
        const parsed = await parseFile(file, { field, requireMeaningfulText: false });
        const trimmed = parsed.trim();
        if (trimmed.length > 0) {
          chunks.push(trimmed);
        }
      } catch (error) {
        mapFieldParseError(error, field);
      }
    }

    if (chunks.length === 0) {
      throw new Error(`FILE_PARSE_FAILED:${field}`);
    }

    return chunks.join("\n\n");
  }

  try {
    return await parseFile(files[0], { field });
  } catch (error) {
    mapFieldParseError(error, field);
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

async function resolveCurrentFeedbackTier(
  request: Request,
  signedInEmail: string,
): Promise<FeedbackAccessTier> {
  let plan: "free" | "pro" = "free";

  if (hasAccountEntitlementStore()) {
    try {
      const entitlement = await getAccountEntitlementByEmail(signedInEmail);
      plan = isActiveProAccountEntitlement(entitlement) ? "pro" : "free";
    } catch {
      plan = "free";
    }
  }

  const creditsBalance = await getCreditBalanceForRequest(request);
  return resolveAccountFeatureTier({
    plan,
    creditsBalance,
  });
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  let usage: UsageCheckResult | undefined;
  let trialReservation: TrialReservation | undefined;
  let evaluationSucceeded = false;
  let reservationReleased = false;
  let stage = "validation";
  const usageHeaders: Record<string, string> = {};
  const releaseReservation = async () => {
    if (!usage?.allowed || evaluationSucceeded || reservationReleased || (!usage.freeReservation && !usage.creditReservation)) return;
    try {
      await settleUsageReservation(usage, false);
      reservationReleased = true;
      Object.assign(usageHeaders, buildUsageLimitHeaders(usage));
      console.info("EVALUATION_RESERVATION_RELEASED", { requestId: context.requestId, stage, billingSource: usage.billingSource });
    } catch (error) {
      console.error("EVALUATION_RESERVATION_RELEASE_FAILED", { requestId: context.requestId, stage, billingSource: usage.billingSource, error });
    }
  };

  try {
    const signedInEmail = getCreditEmailFromCookie(request);

    const projectId = request.headers.get("x-project-id")?.trim() || null;
    if (projectId && !signedInEmail) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to use projects.");
    if (projectId && signedInEmail) {
      try {
        if (!await getProject(signedInEmail, projectId)) return errorResponse(context, 404, "PROJECT_NOT_FOUND", "This project is no longer available. Choose another project.");
      } catch {
        return errorResponse(context, 503, "WORKSPACE_UNAVAILABLE", "Could not open this project. Try again.");
      }
    }

    const contentType = request.headers.get("content-type") ?? "";
    let mode: GradingMode = "standard";
    let rubricSource: "provided" | "general" | "saved" = "provided";
    let rubricId: string | undefined;
    let assignmentInstructions = "";
    let savedRubric: Awaited<ReturnType<typeof getSavedRubric>> = null;
    let rubricFiles: File[] = [];
    let assignmentFiles: File[] = [];
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
      rubricSource = parsedRequest.data.rubricSource;
      rubricId = parsedRequest.data.rubricId;
      assignmentInstructions = parsedRequest.data.assignmentInstructions;
      rubricTextInput = parsedRequest.data.rubricText || null;
      assignmentTextInput = parsedRequest.data.assignmentText;
    } else {
      const formData = await request.formData();
      const modeInput = formData.get("mode");
      const parsedRequest = GradeRequestSchema.safeParse({
        mode: typeof modeInput === "string" ? modeInput : undefined,
        rubricSource: formData.get("rubricSource") ?? undefined,
        rubricId: formData.get("rubricId") ?? undefined,
        assignmentInstructions: formData.get("assignmentInstructions") ?? undefined,
      });

      if (!parsedRequest.success) {
        const invalidMode = parsedRequest.error.issues.some(issue => issue.path[0] === "mode");
        return errorResponse(context, 400, invalidMode ? "INVALID_MODE" : "INVALID_INPUT",
          invalidMode ? "Invalid grading mode. Select Standard or Strict mode." : "Please provide valid grading options and assignment instructions (up to 5,000 characters).");
      }

      mode = parsedRequest.data.mode;
      rubricSource = parsedRequest.data.rubricSource;
      rubricId = parsedRequest.data.rubricId;
      assignmentInstructions = parsedRequest.data.assignmentInstructions;
      rubricFiles = getUploadedFiles(formData, "rubric");
      assignmentFiles = getUploadedFiles(formData, "assignment");
      rubricTextInput = getTextInput(formData, "rubricText");
      assignmentTextInput = getTextInput(formData, "assignmentText");
    }

    if ((rubricSource === "saved") !== Boolean(rubricId) ||
        (rubricSource !== "provided" && (rubricTextInput || rubricFiles.length)) ||
        (rubricSource !== "general" && assignmentInstructions)) {
      return errorResponse(context, 400, "INVALID_INPUT", "Choose one rubric source.");
    }
    if (rubricSource === "saved") {
      if (!signedInEmail) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to use your saved rubrics.");
      try {
        savedRubric = await getSavedRubric(signedInEmail, rubricId!);
        if (!savedRubric) return errorResponse(context, 404, "RUBRIC_NOT_FOUND", "This rubric is no longer available. Choose another rubric.");
      } catch {
        return errorResponse(context, 503, "RUBRIC_LIBRARY_UNAVAILABLE", "Could not open your rubric. Try again.");
      }
    }

    const rubricValidation = validateUploadedFiles(rubricFiles, "rubric");
    if (rubricValidation?.code === "FILE_TOO_LARGE") {
      return errorResponse(context, 400, "FILE_TOO_LARGE", "Rubric file is too large. Max size is 10MB per file.", {
        field: rubricValidation.field,
      });
    }
    if (rubricValidation?.code === "FILE_TOTAL_TOO_LARGE") {
      return errorResponse(
        context,
        400,
        "FILE_TOTAL_TOO_LARGE",
        "Rubric upload is too large. Keep total uploads under 30MB.",
        { field: rubricValidation.field },
      );
    }
    if (rubricValidation?.code === "MULTI_FILE_IMAGES_ONLY") {
      return errorResponse(
        context,
        400,
        "MULTI_FILE_IMAGES_ONLY",
        "Multiple rubric files are supported for photos only. Upload one PDF/DOCX/TXT file or multiple images.",
        { field: rubricValidation.field },
      );
    }

    const assignmentValidation = validateUploadedFiles(assignmentFiles, "assignment");
    if (assignmentValidation?.code === "FILE_TOO_LARGE") {
      return errorResponse(context, 400, "FILE_TOO_LARGE", "Assignment file is too large. Max size is 10MB per file.", {
        field: assignmentValidation.field,
      });
    }
    if (assignmentValidation?.code === "FILE_TOTAL_TOO_LARGE") {
      return errorResponse(
        context,
        400,
        "FILE_TOTAL_TOO_LARGE",
        "Assignment upload is too large. Keep total uploads under 30MB.",
        { field: assignmentValidation.field },
      );
    }
    if (assignmentValidation?.code === "MULTI_FILE_IMAGES_ONLY") {
      return errorResponse(
        context,
        400,
        "MULTI_FILE_IMAGES_ONLY",
        "Multiple assignment files are supported for photos only. Upload one PDF/DOCX/TXT file or multiple images.",
        { field: assignmentValidation.field },
      );
    }

    if (rubricSource === "provided" && !rubricTextInput && rubricFiles.length === 0) {
      return errorResponse(context, 400, "MISSING_INPUT", "Please provide both a rubric and an assignment.");
    }

    if (!assignmentTextInput && assignmentFiles.length === 0) {
      return errorResponse(context, 400, "MISSING_INPUT", "Please provide both a rubric and an assignment.");
    }

    if (!signedInEmail) {
      if (mode !== "standard") return errorResponse(context, 403, "STRICT_MODE_LOCKED", "The guest preview uses Standard mode. Sign up for more options.");
      try {
        trialReservation = await reserveTrial(trialIdentity(request));
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code === "TRIAL_LIMIT_REACHED") return errorResponse(context, 429, code, "Your free preview has been used. Sign up for 3 free checks · No card required.");
        if (code === "TRIAL_PENDING") return errorResponse(context, 409, code, "Your preview is already running. Please wait before trying again.");
        return errorResponse(context, 503, "TRIAL_UNAVAILABLE", "The preview is temporarily unavailable. Please retry shortly.");
      }
    }

    stage = "file_parsing";
    const cacheIdentityPromise = (signedInEmail ? resolveRubricCacheIdentity(request) : Promise.resolve(null)).catch((error) => {
      console.warn("RUBRIC_CACHE_IDENTITY_RESOLUTION_FAILED", {
        requestId: context.requestId,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return null;
    });
    const [rubricText, assignmentText] = await Promise.all([
      rubricSource === "general" ? Promise.resolve(JSON.stringify(generalRubric(assignmentInstructions))) :
        savedRubric ? Promise.resolve(savedRubric.text) : resolveFieldText("rubric", rubricTextInput, rubricFiles),
      resolveFieldText("assignment", assignmentTextInput, assignmentFiles),
    ]);
    if (!signedInEmail && (rubricText.length > TRIAL_TEXT_LIMIT || assignmentText.length > TRIAL_TEXT_LIMIT)) {
      return errorResponse(context, 400, "TRIAL_INPUT_TOO_LONG", "Keep each preview input under 20,000 characters, or sign up to evaluate a longer assignment.");
    }
    const hiddenAiAlert = detectHiddenAiAlert({ rubricText, assignmentText });

    const currentFeedbackTier = signedInEmail ? await resolveCurrentFeedbackTier(request, signedInEmail) : "free";
    if (mode === "strict" && !canUseStrictMode(currentFeedbackTier)) {
      return errorResponse(
        context,
        403,
        "STRICT_MODE_LOCKED",
        "Strict Mode is available with Pro or purchased top-ups. Buy credits or upgrade to continue.",
      );
    }

    let feedbackTier: FeedbackAccessTier = "free";
    if (signedInEmail) {
      stage = "reservation";
      // Scope retry keys to the parsed inputs and mode, never trust a caller's key alone.
      const requestKey = createHash("sha256").update(JSON.stringify([
        request.headers.get("idempotency-key") || randomUUID(), mode, rubricText, assignmentText,
        ...(rubricSource === "provided" ? [] : [rubricSource, rubricId ?? null]),
      ])).digest("hex");
      usage = await checkUsageLimit(request, "evaluate", undefined, requestKey);
      Object.assign(usageHeaders, buildUsageLimitHeaders(usage));
      if (usage.degradedCode === "REDIS_UNAVAILABLE") {
        usageHeaders["x-rubricheck-warning"] = "REDIS_UNAVAILABLE";
      }

      feedbackTier =
        currentFeedbackTier === "pro"
          ? "pro"
          : currentFeedbackTier === "topup" || usage.billingSource === "credit"
            ? "topup"
            : "free";

      if (!usage.allowed) {
        if (usage.errorCode === "EVALUATION_PENDING" || usage.errorCode === "EVALUATION_ALREADY_COMPLETED") {
          return errorResponse(context, 409, usage.errorCode, usage.errorMessage ?? "Please retry shortly.", undefined, usageHeaders);
        }
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
    }
    const cacheIdentity = await cacheIdentityPromise;
    stage = "rubric_structuring";
    let structuredRubric;
    try {
      structuredRubric = rubricSource === "general" ? generalRubric(assignmentInstructions) : savedRubric?.rubric ?? await structureRubric(rubricText, {
        cacheIdentity,
        requestId: context.requestId,
      });
    } catch (error) {
      await releaseReservation();

      if (error instanceof Error && error.message === "OPENAI_TIMEOUT") {
        return errorResponse(
          context,
          504,
          "OPENAI_TIMEOUT",
          "Our AI reviewer is taking longer than usual. Please retry in a moment.",
          undefined, usageHeaders,
        );
      }
      console.error("RUBRIC_STRUCTURE_FAILED", { requestId: context.requestId, error });
      return errorResponse(context, 400, "RUBRIC_STRUCTURE_FAILED", "We could not read the rubric format. Please revise and retry.", undefined, usageHeaders);
    }

    try {
      stage = "ai_evaluation";
      const evaluation = await evaluateAssignment(structuredRubric, assignmentText, mode, {
        detailLevel: feedbackTier === "free" ? "diagnostic" : "detailed",
      });
      const finalEvaluation = {
        ...buildFinalEvaluation(structuredRubric, evaluation, mode, feedbackTier),
        ...(rubricSource === "general" ? { grading_basis: "general" as const } : {}),
        title: assignmentTitle(assignmentText, assignmentFiles.map(file => file.name)),
      };
      if (!signedInEmail && trialReservation) {
        const preview = await completeTrial(trialReservation, { rubric: structuredRubric, assignmentText, result: hiddenAiAlert ? { ...finalEvaluation, hidden_ai_alert: hiddenAiAlert } : finalEvaluation });
        evaluationSucceeded = true;
        return setTrialCookie(NextResponse.json(preview, { headers: { "x-request-id": context.requestId } }), trialReservation);
      }
      if (!signedInEmail || !usage) throw new Error("EVALUATION_FAILED");
      // The user receives a valid result even if confirmation storage is temporarily down.
      // Idempotent retries handle a lost confirmation response without double charging.
      evaluationSucceeded = true;
      stage = "confirmation";
      try {
        await settleUsageReservation(usage, true);
      } catch {
        try { await settleUsageReservation(usage, true); }
        catch (error) {
          console.error("EVALUATION_RESERVATION_CONFIRM_FAILED", { requestId: context.requestId, billingSource: usage.billingSource, error });
        }
      }
      Object.assign(usageHeaders, buildUsageLimitHeaders(usage));
      const headers = new Headers(usageHeaders);
      headers.set("x-request-id", context.requestId);
      if (rubricSource !== "general") {
        try {
          if (savedRubric) {
            if (!await editSavedRubric(signedInEmail, savedRubric.id, "touch")) throw new Error("RUBRIC_NOT_FOUND");
          } else {
            await saveRubric(signedInEmail, rubricText, structuredRubric, rubricTextInput ? [] : rubricFiles);
          }
        } catch {
          headers.set("x-rubric-library-unavailable", "1");
        }
      }
      const result = hiddenAiAlert ? { ...finalEvaluation, hidden_ai_alert: hiddenAiAlert } : finalEvaluation;
      // A recovery outage must not invalidate a successful, billed evaluation.
      try {
        const saved = await saveEvaluation({ email: signedInEmail, rubric: structuredRubric, assignmentText, mode, result });
        try { await archiveAssignment(signedInEmail, saved, mode, projectId); }
        catch { headers.set("x-history-unavailable", "1"); }
        return NextResponse.json(saved, { headers });
      } catch {
        headers.set("x-recovery-unavailable", "1");
        return NextResponse.json(result, { headers });
      }
    } catch (error) {
      await releaseReservation();

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
    await releaseReservation();
    console.error("GRADE_REQUEST_FAILED", { requestId: context.requestId, stage, billingSource: usage?.billingSource, error });
    if (error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING") {
      return errorResponse(context, 503, "REDIS_UNAVAILABLE", "Usage verification is temporarily unavailable. Please retry shortly.");
    }

    if (error instanceof Error && error.message === "MISSING_INPUT") {
      return errorResponse(context, 400, "MISSING_INPUT", "Please provide both a rubric and an assignment.");
    }

    if (error instanceof Error && error.message.startsWith("UNSUPPORTED_FILE_TYPE:")) {
      const field = error.message.split(":")[1] as FieldName;
      return errorResponse(context, 400, "UNSUPPORTED_FILE_TYPE", "Unsupported file type. Upload PDF, DOCX, TXT, PNG, JPG, or JPEG.", { field });
    }

    if (error instanceof Error && error.message.startsWith("FILE_PARSE_FAILED:")) {
      const field = error.message.split(":")[1] as FieldName;
      return errorResponse(context, 400, "FILE_PARSE_FAILED", "We couldn't extract enough text from that file. Try again, upload another format, or paste text.", {
        field,
        hint: "If this is a photo, retake with better lighting, crop tightly, and keep text straight.",
      });
    }

    if (error instanceof Error && error.message.startsWith("OCR_UNAVAILABLE:")) {
      const field = error.message.split(":")[1] as FieldName;
      return errorResponse(
        context,
        503,
        "OCR_UNAVAILABLE",
        "Image OCR is temporarily unavailable. Please retry or paste text directly.",
        { field },
      );
    }

    if (error instanceof Error && error.message.startsWith("MULTI_FILE_IMAGES_ONLY:")) {
      const field = error.message.split(":")[1] as FieldName;
      return errorResponse(
        context,
        400,
        "MULTI_FILE_IMAGES_ONLY",
        "Multiple files are supported for photos only. Upload one PDF/DOCX/TXT file or multiple images.",
        { field },
      );
    }

    if (error instanceof FileParseValidationError) {
      return errorResponse(context, 400, "FILE_PARSE_FAILED", "We couldn't parse the uploaded file. Try another format or paste text.", {
        parseError: error.message,
      });
    }

    return errorResponse(context, 500, "INTERNAL_SERVER_ERROR", "Failed to process uploaded files.");
  } finally {
    if (trialReservation && !evaluationSucceeded) {
      try { await releaseTrial(trialReservation); }
      catch { console.error("TRIAL_RELEASE_FAILED", { requestId: context.requestId }); }
    }
  }
}
