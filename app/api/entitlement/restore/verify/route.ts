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
import { verifyRestoreOtp } from "../../../../../src/lib/entitlementRestoreOtp";
import { createRequestContext, errorResponse } from "../../../../../src/lib/apiError";

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
  let payload: RestoreVerifyRequestBody;

  try {
    payload = (await request.json()) as RestoreVerifyRequestBody;
  } catch {
    return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const email = normalizeEmailInput(payload.email);
  const code = normalizeOtpCode(payload.code);

  if (!isValidEmail(email)) {
    return errorResponse(context, 400, "INVALID_EMAIL", "Please enter a valid email.");
  }

  if (!/^\d{6}$/.test(code)) {
    return errorResponse(context, 400, "INVALID_CODE", "Enter a valid 6-digit code.");
  }

  try {
    const isOtpValid = await verifyRestoreOtp(request, email, code);
    if (!isOtpValid) {
      return errorResponse(context, 400, "INVALID_CODE", "Invalid or expired code.");
    }

    const resolved = await resolveActiveEntitlementByVerifiedEmail(email);
    if (!resolved) {
      return NextResponse.json(
        {
          ok: false,
          status: "not_active",
        },
        { headers: { "x-request-id": context.requestId } },
      );
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ENTITLEMENT_SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "RESTORE_OTP_RATE_LIMITED") {
      return errorResponse(context, 429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
    }

    if (
      error instanceof Error &&
      (error.message === "UPSTASH_REDIS_CONFIG_MISSING" ||
        error.message === "ENTITLEMENT_OTP_SECRET_MISSING" ||
        error.message === "ENTITLEMENT_SESSION_SECRET_MISSING" ||
        error.message === "STRIPE_SECRET_KEY_MISSING")
    ) {
      return errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Restore is temporarily unavailable. Please try again shortly.");
    }

    console.error("ENTITLEMENT_RESTORE_VERIFY_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "ENTITLEMENT_RESTORE_VERIFY_FAILED", "Unable to verify restore right now.");
  }
}
