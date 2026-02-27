import Stripe from "stripe";

import { includesProLookupKey } from "../../../../src/config/proCheckout";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import {
  ENTITLEMENT_SESSION_COOKIE_NAME,
  ENTITLEMENT_SESSION_TTL_SECONDS,
  createEntitlementSessionToken,
  getPlanFromEntitlementCookie,
} from "../../../../src/lib/entitlementSession";
import { upsertAccountEntitlement } from "../../../../src/lib/accountEntitlements";

export const runtime = "nodejs";

type ActivateCheckoutRequestBody = {
  sessionId?: unknown;
};

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY_MISSING");
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

function normalizeSessionId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidSessionId(sessionId: string): boolean {
  return /^cs_[A-Za-z0-9_]+$/.test(sessionId);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  if (!includesProLookupKey(getSubscriptionLookupKeys(subscription))) {
    return false;
  }

  return subscription.status === "active" || subscription.status === "trialing";
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));

  if (periodEnds.length > 0) {
    return Math.max(...periodEnds);
  }

  return subscription.cancel_at ?? subscription.ended_at ?? Math.floor(Date.now() / 1000);
}

function getSessionCustomerEmail(session: Stripe.Checkout.Session): string | null {
  const fromCustomerDetails = normalizeEmail(session.customer_details?.email);
  if (fromCustomerDetails) {
    return fromCustomerDetails;
  }

  const fromSession = normalizeEmail(session.customer_email);
  if (fromSession) {
    return fromSession;
  }

  if (
    session.customer &&
    typeof session.customer !== "string" &&
    !("deleted" in session.customer && session.customer.deleted === true)
  ) {
    const fromCustomer = normalizeEmail(session.customer.email);
    if (fromCustomer) {
      return fromCustomer;
    }
  }

  return null;
}

function getSessionSubscriptionId(session: Stripe.Checkout.Session): string | null {
  if (!session.subscription) {
    return null;
  }

  if (typeof session.subscription === "string") {
    const normalized = session.subscription.trim();
    return normalized || null;
  }

  const normalized = session.subscription.id?.trim() ?? "";
  return normalized || null;
}

export async function POST(request: Request) {
  const context = createRequestContext(request);

  if (getPlanFromEntitlementCookie(request) === "pro") {
    return successJson(context, { ok: true, status: "active", plan: "pro" });
  }

  let payload: ActivateCheckoutRequestBody;
  try {
    payload = (await request.json()) as ActivateCheckoutRequestBody;
  } catch {
    return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const sessionId = normalizeSessionId(payload.sessionId);
  if (!sessionId || !isValidSessionId(sessionId)) {
    return errorResponse(context, 400, "INVALID_SESSION_ID", "A valid checkout session id is required.");
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });

    if (session.mode !== "subscription") {
      return errorResponse(context, 409, "SESSION_NOT_SUBSCRIPTION", "This checkout session is not a subscription session.");
    }

    const isPaymentReady = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!isPaymentReady) {
      return successJson(context, { ok: false, status: "pending" });
    }

    const subscriptionId = getSessionSubscriptionId(session);
    if (!subscriptionId) {
      return successJson(context, { ok: false, status: "pending" });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    if (!isActiveProSubscription(subscription)) {
      return successJson(context, { ok: false, status: "pending" });
    }

    const email = getSessionCustomerEmail(session);
    if (!email || !isValidEmail(email)) {
      return errorResponse(context, 409, "SESSION_EMAIL_MISSING", "Checkout email is unavailable for activation.");
    }

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer && !("deleted" in session.customer && session.customer.deleted === true)
          ? session.customer.id
          : null;

    if (customerId) {
      await upsertAccountEntitlement({
        customerId,
        email,
        status: "active",
        currentPeriodEnd: getCurrentPeriodEnd(subscription),
      });
    }

    const token = createEntitlementSessionToken({ email, plan: "pro" });
    const response = successJson(context, { ok: true, status: "active", plan: "pro", email });
    response.cookies.set({
      name: ENTITLEMENT_SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ENTITLEMENT_SESSION_TTL_SECONDS,
    });

    return response;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return errorResponse(context, 400, "CHECKOUT_SESSION_NOT_FOUND", "Checkout session was not found.");
    }

    return errorResponse(context, 500, "CHECKOUT_ACTIVATION_FAILED", "Unable to activate Pro from checkout right now.");
  }
}
