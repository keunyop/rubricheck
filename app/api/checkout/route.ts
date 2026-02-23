import Stripe from "stripe";
import {
  getLookupKeyForProCheckoutPlan,
  resolveProCheckoutPlan,
} from "../../../src/config/proCheckout";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";
import {
  getPayloadSizeApprox,
  hashEmail,
  recordAbuseTelemetry,
  shouldEnforceForSuspicious,
} from "../../../src/lib/abuseTelemetry";

export const runtime = "nodejs";

type CheckoutRequestBody = {
  plan?: unknown;
  priceId?: unknown;
  email?: unknown;
};

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY_MISSING");
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const startedAt = Date.now();
  let requestEmail = "";

  const respond = async (response: Response, outcome: "success" | "error") => {
    const telemetry = await recordAbuseTelemetry({
      requestId: context.requestId,
      endpoint: "checkout_session",
      request,
      outcome,
      email: requestEmail,
      latencyMs: Date.now() - startedAt,
      payloadSizeApprox: getPayloadSizeApprox(request),
    });

    if (shouldEnforceForSuspicious(telemetry.suspicious)) {
      return errorResponse(context, 429, "ABUSE_BLOCKED", "Request blocked by abuse controls.");
    }

    return response;
  };

  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const requestedPlan = resolveProCheckoutPlan({ plan: body.plan, priceId: body.priceId });
    requestEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!requestedPlan) return respond(errorResponse(context, 400, "INVALID_PLAN", "Selected plan is invalid."), "error");
    if (!requestEmail) return respond(errorResponse(context, 400, "MISSING_EMAIL", "Email is required."), "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail)) return respond(errorResponse(context, 400, "INVALID_EMAIL", "Email address is invalid."), "error");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) return respond(errorResponse(context, 500, "APP_URL_MISSING", "Checkout is not configured."), "error");

    const lookupKey = getLookupKeyForProCheckoutPlan(requestedPlan);
    const priceResult = await getStripeClient().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const stripePriceId = priceResult.data[0]?.id;
    if (!stripePriceId) return respond(errorResponse(context, 500, "STRIPE_PRICE_NOT_FOUND", "Checkout price is unavailable."), "error");

    const session = await getStripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: requestEmail,
      success_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: { pro_plan: requestedPlan },
    });

    if (!session.url) {
      return respond(errorResponse(context, 500, "CHECKOUT_SESSION_URL_MISSING", "Checkout session is unavailable."), "error");
    }

    return respond(successJson(context, { url: session.url, plan: requestedPlan }), "success");
  } catch (error) {
    if (error instanceof SyntaxError) return respond(errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON."), "error");
    console.error("CHECKOUT_SESSION_FAILED", { requestId: context.requestId, error, emailHash: hashEmail(requestEmail) });
    return respond(errorResponse(context, 500, "CHECKOUT_SESSION_FAILED", "Unable to start checkout right now."), "error");
  }
}
