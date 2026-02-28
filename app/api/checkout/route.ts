import Stripe from "stripe";
import {
  getLookupKeyForProCheckoutPlan,
  includesProLookupKey,
  resolveProCheckoutPlan,
} from "../../../src/config/proCheckout";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";
import {
  getPayloadSizeApprox,
  hashEmail,
  recordAbuseTelemetry,
  shouldEnforceForSuspicious,
} from "../../../src/lib/abuseTelemetry";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";

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

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getSubscriptionLookupKeys(subscription: Stripe.Subscription): string[] {
  return subscription.items.data
    .map((item) => {
      const price = item.price;
      if (!price || typeof price === "string") {
        return null;
      }

      return typeof price.lookup_key === "string" ? price.lookup_key.trim() : null;
    })
    .filter((value): value is string => Boolean(value));
}

function isActiveProSubscription(subscription: Stripe.Subscription): boolean {
  const isPro = includesProLookupKey(getSubscriptionLookupKeys(subscription));
  if (!isPro) {
    return false;
  }

  return subscription.status === "active" || subscription.status === "trialing";
}

async function findCustomerIdsByEmail(email: string): Promise<string[]> {
  const stripe = getStripeClient();
  try {
    const searchResult = await stripe.customers.search({
      query: `email:'${escapeStripeSearchValue(email)}'`,
      limit: 10,
    });

    return searchResult.data
      .map((customer) => customer.id.trim())
      .filter((customerId) => customerId.length > 0);
  } catch {
    const listResult = await stripe.customers.list({
      email,
      limit: 10,
    });

    return listResult.data
      .map((customer) => customer.id.trim())
      .filter((customerId) => customerId.length > 0);
  }
}

async function emailHasActiveProSubscription(email: string): Promise<boolean> {
  const stripe = getStripeClient();
  const customerIds = await findCustomerIdsByEmail(email);
  if (customerIds.length === 0) {
    return false;
  }

  for (const customerId of customerIds) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
      expand: ["data.items.data.price"],
    });

    if (subscriptions.data.some((subscription) => isActiveProSubscription(subscription))) {
      return true;
    }
  }

  return false;
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
    const bodyEmail = normalizeEmail(body.email);
    const signedInEmail = getCreditEmailFromCookie(request);
    requestEmail = signedInEmail ?? bodyEmail;

    if (!requestedPlan) return respond(errorResponse(context, 400, "INVALID_PLAN", "Selected plan is invalid."), "error");
    if (!signedInEmail) {
      return respond(errorResponse(context, 401, "AUTH_REQUIRED", "Log in before starting checkout."), "error");
    }
    if (bodyEmail && bodyEmail !== signedInEmail) {
      return respond(
        errorResponse(context, 409, "CHECKOUT_EMAIL_MISMATCH", "Checkout email must match the signed-in account."),
        "error",
      );
    }
    if (!isValidEmail(signedInEmail)) {
      return respond(errorResponse(context, 409, "SESSION_EMAIL_INVALID", "Signed-in email is invalid."), "error");
    }
    requestEmail = signedInEmail;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) return respond(errorResponse(context, 500, "APP_URL_MISSING", "Checkout is not configured."), "error");

    const alreadyActivePro = await emailHasActiveProSubscription(requestEmail);
    if (alreadyActivePro) {
      return respond(
        errorResponse(
          context,
          409,
          "ALREADY_PRO_ACTIVE",
          "This email already has an active Pro subscription. Please log in instead of purchasing again.",
        ),
        "error",
      );
    }

    const lookupKey = getLookupKeyForProCheckoutPlan(requestedPlan);
    const priceResult = await getStripeClient().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const stripePriceId = priceResult.data[0]?.id;
    if (!stripePriceId) return respond(errorResponse(context, 500, "STRIPE_PRICE_NOT_FOUND", "Checkout price is unavailable."), "error");

    const session = await getStripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: requestEmail,
      success_url: `${appUrl}/?checkout_session_id={CHECKOUT_SESSION_ID}`,
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
