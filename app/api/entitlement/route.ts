import { NextResponse } from "next/server";

import { getPlanFromEntitlementCookie } from "../../../src/lib/entitlementSession";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const planFromCookie = getPlanFromEntitlementCookie(request);

  if (planFromCookie === "pro") {
    return NextResponse.json({
      plan: "pro",
      status: "active",
    });
  }

  return NextResponse.json({
    plan: "free",
    status: "needs_restore",
  });
}

export async function POST() {
  return NextResponse.json({ error: "RESTORE_FLOW_REQUIRED" }, { status: 410 });
}
