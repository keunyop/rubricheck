import { isValidEmail, normalizeEmailInput } from "../../../../../src/lib/entitlementRestore";
import { startRestoreOtp } from "../../../../../src/lib/entitlementRestoreOtp";
import { createRequestContext, errorResponse, successJson } from "../../../../../src/lib/apiError";

export const runtime = "nodejs";

type RestoreStartRequestBody = { email?: unknown };

const GENERIC_START_RESPONSE = {
  ok: true,
  message: "If that email can receive recovery codes, a code has been sent.",
};

export async function POST(request: Request) {
  const context = createRequestContext(request);
  let payload: RestoreStartRequestBody;

  try {
    payload = (await request.json()) as RestoreStartRequestBody;
  } catch {
    return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const email = normalizeEmailInput(payload.email);
  if (!isValidEmail(email)) {
    return errorResponse(context, 400, "INVALID_EMAIL", "Please enter a valid email.");
  }

  try {
    await startRestoreOtp(request, email);
    return successJson(context, GENERIC_START_RESPONSE);
  } catch (error) {
    if (error instanceof Error && error.message === "RESTORE_OTP_RATE_LIMITED") {
      return errorResponse(context, 429, "RATE_LIMITED", "Too many requests. Please wait and try again.");
    }

    if (
      error instanceof Error &&
      (error.message === "UPSTASH_REDIS_CONFIG_MISSING" ||
        error.message === "ENTITLEMENT_OTP_SECRET_MISSING" ||
        error.message === "OTP_EMAIL_PROVIDER_NOT_CONFIGURED" ||
        error.message === "OTP_EMAIL_SEND_FAILED")
    ) {
      return errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Restore is temporarily unavailable. Please try again shortly.");
    }

    console.error("ENTITLEMENT_RESTORE_START_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "ENTITLEMENT_RESTORE_START_FAILED", "Unable to send a verification code right now.");
  }
}
