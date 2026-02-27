import { NextResponse } from "next/server";

import {
  isValidEmail,
  normalizeEmailInput,
  resolveActiveEntitlementByVerifiedEmail,
} from "../../../../../src/lib/entitlementRestore";
import {
  ENTITLEMENT_SESSION_COOKIE_NAME,
  ENTITLEMENT_SESSION_TTL_SECONDS,
  createEntitlementSessionToken,
} from "../../../../../src/lib/entitlementSession";
import {
  CREDIT_SESSION_COOKIE_NAME,
  CREDIT_SESSION_TTL_SECONDS,
  createCreditSessionToken,
} from "../../../../../src/lib/creditSession";
import { verifyRestoreOtp } from "../../../../../src/lib/entitlementRestoreOtp";
import { createRequestContext, errorResponse } from "../../../../../src/lib/apiError";
import {
  getPayloadSizeApprox,
  hashEmail,
  recordAbuseTelemetry,
  shouldEnforceForSuspicious,
} from "../../../../../src/lib/abuseTelemetry";

export const runtime = "nodejs";

type RestoreVerifyRequestBody = {
  email?: unknown;
  code?: unknown;
};

function normalizeOtpCode(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const startedAt = Date.now();
  let email = "";

  const respond = async (response: Response, outcome: "success" | "error") => {
    const telemetry = await recordAbuseTelemetry({
      requestId: context.requestId,
      endpoint: "otp_verify",
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

  let payload: RestoreVerifyRequestBody;

  try {
    payload = (await request.json()) as RestoreVerifyRequestBody;
  } catch {
    return respond(errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON."), "error");
  }

  email = normalizeEmailInput(payload.email);
  const code = normalizeOtpCode(payload.code);

  if (!isValidEmail(email)) {
    return respond(errorResponse(context, 400, "INVALID_EMAIL", "Please enter a valid email."), "error");
  }

  if (!/^\d{6}$/.test(code)) {
    return respond(errorResponse(context, 400, "INVALID_CODE", "Enter a valid 6-digit code."), "error");
  }

  try {
    const isOtpValid = await verifyRestoreOtp(request, email, code);
    if (!isOtpValid) {
      return respond(errorResponse(context, 400, "INVALID_CODE", "Invalid or expired code."), "error");
    }

    const resolved = await resolveActiveEntitlementByVerifiedEmail(email);
    const creditToken = createCreditSessionToken({ email });
    const isSecureCookie = process.env.NODE_ENV === "production";

    if (!resolved) {
      const response = NextResponse.json(
        {
          ok: true,
          status: "signed_in",
          plan: "free",
        },
        { headers: { "x-request-id": context.requestId } },
      );

      response.cookies.set({
        name: ENTITLEMENT_SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      response.cookies.set({
        name: CREDIT_SESSION_COOKIE_NAME,
        value: creditToken,
        httpOnly: true,
        secure: isSecureCookie,
        sameSite: "lax",
        path: "/",
        maxAge: CREDIT_SESSION_TTL_SECONDS,
      });

      return respond(response, "success");
    }

    const token = createEntitlementSessionToken({ email, plan: "pro" });
    const response = NextResponse.json(
      {
        ok: true,
        status: "active",
        plan: "pro",
      },
      { headers: { "x-request-id": context.requestId } },
    );

    response.cookies.set({
      name: ENTITLEMENT_SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: ENTITLEMENT_SESSION_TTL_SECONDS,
    });
    response.cookies.set({
      name: CREDIT_SESSION_COOKIE_NAME,
      value: creditToken,
      httpOnly: true,
      secure: isSecureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: CREDIT_SESSION_TTL_SECONDS,
    });

    return respond(response, "success");
  } catch (error) {
    if (error instanceof Error && error.message === "RESTORE_OTP_RATE_LIMITED") {
      return respond(errorResponse(context, 429, "RATE_LIMITED", "Too many attempts. Please wait and try again."), "error");
    }

    if (
      error instanceof Error &&
      (error.message === "UPSTASH_REDIS_CONFIG_MISSING" ||
        error.message === "ENTITLEMENT_OTP_SECRET_MISSING" ||
        error.message === "ENTITLEMENT_SESSION_SECRET_MISSING" ||
        error.message === "CREDIT_SESSION_SECRET_MISSING" ||
        error.message === "STRIPE_SECRET_KEY_MISSING")
    ) {
      return respond(errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Restore is temporarily unavailable. Please try again shortly."), "error");
    }

    console.error("ENTITLEMENT_RESTORE_VERIFY_FAILED", { requestId: context.requestId, error, emailHash: hashEmail(email) });
    return respond(errorResponse(context, 500, "ENTITLEMENT_RESTORE_VERIFY_FAILED", "Unable to verify restore right now."), "error");
  }
}
