import { NextResponse } from "next/server";

import { isValidEmail, normalizeEmailInput } from "../../../../../src/lib/entitlementRestore";
import { startRestoreOtp } from "../../../../../src/lib/entitlementRestoreOtp";

export const runtime = "nodejs";

type RestoreStartRequestBody = {
  email?: unknown;
};

const GENERIC_START_RESPONSE = {
  ok: true,
  message: "If that email can receive recovery codes, a code has been sent.",
};

export async function POST(request: Request) {
  let payload: RestoreStartRequestBody;

  try {
    payload = (await request.json()) as RestoreStartRequestBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = normalizeEmailInput(payload.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  try {
    await startRestoreOtp(request, email);
    return NextResponse.json(GENERIC_START_RESPONSE);
  } catch (error) {
    if (error instanceof Error && error.message === "RESTORE_OTP_RATE_LIMITED") {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    if (
      error instanceof Error &&
      (error.message === "UPSTASH_REDIS_CONFIG_MISSING" ||
        error.message === "ENTITLEMENT_OTP_SECRET_MISSING" ||
        error.message === "OTP_EMAIL_PROVIDER_NOT_CONFIGURED" ||
        error.message === "OTP_EMAIL_SEND_FAILED")
    ) {
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    console.error("ENTITLEMENT_RESTORE_START_FAILED", error);
    return NextResponse.json({ error: "ENTITLEMENT_RESTORE_START_FAILED" }, { status: 500 });
  }
}
