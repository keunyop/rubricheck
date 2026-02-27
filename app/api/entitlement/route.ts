import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import {
  getAccountEntitlementByEmail,
  hasAccountEntitlementStore,
  isActiveProAccountEntitlement,
} from "../../../src/lib/accountEntitlements";
import { getEntitlementEmailFromCookie, getPlanFromEntitlementCookie } from "../../../src/lib/entitlementSession";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const signedInEmail = getEntitlementEmailFromCookie(request) ?? getCreditEmailFromCookie(request);
  const cookiePlan = getPlanFromEntitlementCookie(request);

  if (signedInEmail && hasAccountEntitlementStore()) {
    try {
      const entitlement = await getAccountEntitlementByEmail(signedInEmail);
      if (isActiveProAccountEntitlement(entitlement)) {
        return successJson(context, { plan: "pro", status: "active" });
      }

      return successJson(context, { plan: "free", status: "needs_restore" });
    } catch (error) {
      console.error("ENTITLEMENT_DB_LOOKUP_FAILED", { requestId: context.requestId, error });
      if (cookiePlan === "pro") {
        return successJson(context, { plan: "pro", status: "active" });
      }
      return errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Entitlement lookup is temporarily unavailable.");
    }
  }

  if (cookiePlan === "pro") {
    return successJson(context, { plan: "pro", status: "active" });
  }

  return successJson(context, { plan: "free", status: "needs_restore" });
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  return errorResponse(context, 409, "RESTORE_FLOW_REQUIRED", "Use the restore flow to activate entitlement on this device.");
}
