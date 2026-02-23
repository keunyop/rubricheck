import { getPlanFromEntitlementCookie } from "../../../src/lib/entitlementSession";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const planFromCookie = getPlanFromEntitlementCookie(request);

  if (planFromCookie === "pro") {
    return successJson(context, { plan: "pro", status: "active" });
  }

  return successJson(context, { plan: "free", status: "needs_restore" });
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  return errorResponse(context, 409, "RESTORE_FLOW_REQUIRED", "Use the restore flow to activate entitlement on this device.");
}
