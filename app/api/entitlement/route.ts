import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import {
  getAccountEntitlementByEmail,
  hasAccountEntitlementStore,
  isAccountEntitlementStoreUnavailableError,
  isActiveProAccountEntitlement,
} from "../../../src/lib/accountEntitlements";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const signedInEmail = getCreditEmailFromCookie(request);

  if (signedInEmail && hasAccountEntitlementStore()) {
    try {
      const entitlement = await getAccountEntitlementByEmail(signedInEmail);
      if (isActiveProAccountEntitlement(entitlement)) {
        return successJson(context, { plan: "pro", status: "active" });
      }

      return successJson(context, { plan: "free", status: "needs_restore" });
    } catch (error) {
      if (!isAccountEntitlementStoreUnavailableError(error)) {
        console.error("ENTITLEMENT_DB_LOOKUP_FAILED", { requestId: context.requestId, error });
        return errorResponse(context, 503, "SERVICE_UNAVAILABLE", "Entitlement lookup is temporarily unavailable.");
      }
      return successJson(context, { plan: "free", status: "needs_restore" });
    }
  }

  return successJson(context, { plan: "free", status: "needs_restore" });
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  return errorResponse(context, 409, "RESTORE_FLOW_REQUIRED", "Use the restore flow to activate entitlement on this device.");
}
