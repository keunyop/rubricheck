import { isValidEmail, normalizeEmailInput } from "../../../../../src/lib/entitlementRestore";
import { startRestoreOtp } from "../../../../../src/lib/entitlementRestoreOtp";
import { createRequestContext, errorResponse, successJson } from "../../../../../src/lib/apiError";
import {
  getPayloadSizeApprox,
  hashEmail,
  recordAbuseTelemetry,
  shouldEnforceForSuspicious,
} from "../../../../../src/lib/abuseTelemetry";

export const runtime = "nodejs";

type RestoreStartRequestBody = { email?: unknown };
type RestoreStartSuccessResponse = {
  ok: true;
  message: string;
  devCode?: string;
};

const GENERIC_START_RESPONSE: RestoreStartSuccessResponse = {
  ok: true,
  message: "If that email can receive recovery codes, a code has been sent.",
};

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const startedAt = Date.now();
  let email = "";

  const respond = async (response: Response, outcome: "success" | "error") => {
    const telemetry = await recordAbuseTelemetry({
      requestId: context.requestId,
      endpoint: "otp_start",
      request,
      outcome,
      email,
      latencyMs: Date.now() - startedAt,
      payloadSizeApprox: getPayloadSizeApprox(request),
    });

    if (shouldEnforceForSuspicious(telemetry.suspicious)) {
      return errorResponse(context, 429, "ABUSE_BLOCKED", "Request blocked by abuse controls.");
    }

    return response;
  };

  let payload: RestoreStartRequestBody;

  try {
    payload = (await request.json()) as RestoreStartRequestBody;
  } catch {
    return respond(errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON."), "error");
  }

  email = normalizeEmailInput(payload.email);
  if (!isValidEmail(email)) {
    return respond(errorResponse(context, 400, "INVALID_EMAIL", "Please enter a valid email."), "error");
  }

  try {
    const result = await startRestoreOtp(request, email);
    const payload: RestoreStartSuccessResponse = {
      ...GENERIC_START_RESPONSE,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    };
    return respond(successJson(context, payload), "success");
  } catch (error) {
    if (error instanceof Error && error.message === "RESTORE_OTP_RATE_LIMITED") {
      return respond(errorResponse(context, 429, "RATE_LIMITED", "Too many requests. Please wait and try again."), "error");
    }

    if (
      error instanceof Error &&
      (error.message === "UPSTASH_REDIS_CONFIG_MISSING" ||
        error.message === "ENTITLEMENT_OTP_SECRET_MISSING" ||
        error.message === "OTP_EMAIL_PROVIDER_NOT_CONFIGURED" ||
        error.message === "OTP_EMAIL_SEND_FAILED")
    ) {
      return respond(errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Restore is temporarily unavailable. Please try again shortly."), "error");
    }

    console.error("ENTITLEMENT_RESTORE_START_FAILED", { requestId: context.requestId, error, emailHash: hashEmail(email) });
    return respond(errorResponse(context, 500, "ENTITLEMENT_RESTORE_START_FAILED", "Unable to send a verification code right now."), "error");
  }
}
