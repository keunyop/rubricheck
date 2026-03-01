import { FREE_TRIAL_LIMIT } from "../../../../src/config/plans";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getCreditBalanceForRequest } from "../../../../src/lib/credits";
import { getFreeEvaluateUsageCount } from "../../../../src/lib/freeUsage";
import {
  getAccountEntitlementByEmail,
  hasAccountEntitlementStore,
  isAccountEntitlementStoreUnavailableError,
  isActiveProAccountEntitlement,
} from "../../../../src/lib/accountEntitlements";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);

  try {
    const creditEmail = getCreditEmailFromCookie(request);
    const creditsBalance = await getCreditBalanceForRequest(request);
    const normalizedCreditsBalance =
      typeof creditsBalance === "number" && Number.isFinite(creditsBalance) ? Math.max(0, creditsBalance) : null;
    const email = creditEmail ?? null;
    const signedIn = Boolean(email);

    if (!signedIn) {
      return successJson(context, {
        signedIn: false,
        email: null,
        plan: "free",
        remainingEvaluations: null,
        creditsBalance: normalizedCreditsBalance,
      });
    }

    let plan: "free" | "pro" = "free";
    if (email && hasAccountEntitlementStore()) {
      try {
        const entitlement = await getAccountEntitlementByEmail(email);
        plan = isActiveProAccountEntitlement(entitlement) ? "pro" : "free";
      } catch (lookupError) {
        if (!isAccountEntitlementStoreUnavailableError(lookupError)) {
          console.error("ACCOUNT_SUMMARY_ENTITLEMENT_LOOKUP_FAILED", {
            requestId: context.requestId,
            lookupError,
          });
        }
      }
    }

    let usageCount: number | null = null;
    if (plan === "free" && email) {
      try {
        usageCount = await getFreeEvaluateUsageCount(email);
      } catch (lookupError) {
        console.error("ACCOUNT_SUMMARY_FREE_USAGE_LOOKUP_FAILED", {
          requestId: context.requestId,
          lookupError,
        });
      }
    }
    const remainingByPlan = usageCount === null ? null : Math.max(0, FREE_TRIAL_LIMIT - usageCount);

    const remainingEvaluations =
      plan === "free"
        ? remainingByPlan === null
          ? normalizedCreditsBalance
          : remainingByPlan + Math.max(0, normalizedCreditsBalance ?? 0)
        : remainingByPlan;

    return successJson(context, {
      signedIn: true,
      email,
      plan,
      remainingEvaluations,
      creditsBalance: normalizedCreditsBalance,
    });
  } catch (error) {
    console.error("ACCOUNT_SUMMARY_FETCH_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "ACCOUNT_SUMMARY_FETCH_FAILED", "Unable to load account summary right now.");
  }
}
