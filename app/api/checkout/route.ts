import Stripe from "stripe";
import {
  getLookupKeyForProCheckoutPlan,
  resolveProCheckoutPlan,
} from "../../../src/config/proCheckout";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";

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
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const requestedPlan = resolveProCheckoutPlan({ plan: body.plan, priceId: body.priceId });
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!requestedPlan) return errorResponse(context, 400, "INVALID_PLAN", "Selected plan is invalid.");
    if (!email) return errorResponse(context, 400, "MISSING_EMAIL", "Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(context, 400, "INVALID_EMAIL", "Email address is invalid.");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) return errorResponse(context, 500, "APP_URL_MISSING", "Checkout is not configured.");

    const lookupKey = getLookupKeyForProCheckoutPlan(requestedPlan);
    const priceResult = await getStripeClient().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const stripePriceId = priceResult.data[0]?.id;
    if (!stripePriceId) return errorResponse(context, 500, "STRIPE_PRICE_NOT_FOUND", "Checkout price is unavailable.");

    const session = await getStripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: email,
      success_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: { pro_plan: requestedPlan },
    });

    if (!session.url) return errorResponse(context, 500, "CHECKOUT_SESSION_URL_MISSING", "Checkout session is unavailable.");
    return successJson(context, { url: session.url, plan: requestedPlan });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
    console.error("CHECKOUT_SESSION_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "CHECKOUT_SESSION_FAILED", "Unable to start checkout right now.");
  }
}
