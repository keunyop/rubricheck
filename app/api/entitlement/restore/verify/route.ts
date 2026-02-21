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

export const runtime = "nodejs";

type RestoreVerifyRequestBody = {
  email?: unknown;
  code?: unknown;
};

function normalizeOtpCode(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let payload: RestoreVerifyRequestBody;

  try {
    payload = (await request.json()) as RestoreVerifyRequestBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = normalizeEmailInput(payload.email);
  const code = normalizeOtpCode(payload.code);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
  }

  try {
    const isOtpValid = await verifyRestoreOtp(request, email, code);
    if (!isOtpValid) {
      return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
    }

    const resolved = await resolveActiveEntitlementByVerifiedEmail(email);
    if (!resolved) {
      return NextResponse.json(
        {
          ok: false,
          status: "not_active",
        },
        { status: 200 },
      );
    }

    const token = createEntitlementSessionToken({ email, plan: "pro" });
    const response = NextResponse.json({
      ok: true,
      status: "active",
      plan: "pro",
    });

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
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    if (
      error instanceof Error &&
      (error.message === "UPSTASH_REDIS_CONFIG_MISSING" ||
        error.message === "ENTITLEMENT_OTP_SECRET_MISSING" ||
        error.message === "ENTITLEMENT_SESSION_SECRET_MISSING" ||
        error.message === "STRIPE_SECRET_KEY_MISSING")
    ) {
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    console.error("ENTITLEMENT_RESTORE_VERIFY_FAILED", error);
    return NextResponse.json({ error: "ENTITLEMENT_RESTORE_VERIFY_FAILED" }, { status: 500 });
  }
}
