import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { findManageableProCustomerIdByEmail, getStripeClient } from "../../../../src/lib/stripeServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const signedInEmail = getCreditEmailFromCookie(request);

  if (!signedInEmail) {
    return errorResponse(context, 401, "AUTH_REQUIRED", "Log in before managing billing.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    return errorResponse(context, 500, "APP_URL_MISSING", "Billing portal is not configured.");
  }

  try {
    const customerId = await findManageableProCustomerIdByEmail(signedInEmail);
    if (!customerId) {
      return errorResponse(context, 404, "BILLING_CUSTOMER_NOT_FOUND", "No billing customer was found for this account.");
    }

    const session = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/pricing`,
    });

    if (!session.url) {
      return errorResponse(context, 500, "BILLING_PORTAL_URL_MISSING", "Billing portal is unavailable right now.");
    }

    return successJson(context, { url: session.url });
  } catch (error) {
    console.error("BILLING_PORTAL_SESSION_FAILED", {
      requestId: context.requestId,
      error,
    });
    return errorResponse(context, 500, "BILLING_PORTAL_SESSION_FAILED", "Unable to open billing management right now.");
  }
}
