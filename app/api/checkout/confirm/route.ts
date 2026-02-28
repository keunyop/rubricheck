import Stripe from "stripe";

import {
  getCreditsForCreditPack,
  normalizeCreditPackId,
  resolveCreditPackIdFromLookupKey,
  type CreditPackId,
} from "../../../../src/config/creditPacks";
import { includesProLookupKey } from "../../../../src/config/proCheckout";
import {
  CREDIT_SESSION_COOKIE_NAME,
  CREDIT_SESSION_TTL_SECONDS,
  createCreditSessionToken,
  getCreditEmailFromCookie,
} from "../../../../src/lib/creditSession";
import { grantCredits, markCreditsSessionProcessed } from "../../../../src/lib/credits";
import { grantCreditsExactlyOnce } from "../../../../src/lib/creditsGrant";
import {
  ENTITLEMENT_SESSION_COOKIE_NAME,
  ENTITLEMENT_SESSION_TTL_SECONDS,
  createEntitlementSessionToken,
} from "../../../../src/lib/entitlementSession";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { upsertAccountEntitlement } from "../../../../src/lib/accountEntitlements";

export const runtime = "nodejs";

type ConfirmCheckoutRequestBody = {
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

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) {
    return null;
  }

  if (typeof customer === "string") {
    return customer.trim() || null;
  }

  return typeof customer.id === "string" && customer.id.trim() ? customer.id : null;
}

function getPaymentIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | null {
  if (!paymentIntent) {
    return null;
  }

  if (typeof paymentIntent === "string") {
    return paymentIntent.trim() || null;
  }

  return typeof paymentIntent.id === "string" && paymentIntent.id.trim() ? paymentIntent.id : null;
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

async function resolveCreditPackIdFromSessionLineItems(sessionId: string): Promise<CreditPackId | null> {
  const lineItems = await getStripeClient().checkout.sessions.listLineItems(sessionId, {
    limit: 20,
    expand: ["data.price"],
  });

  for (const item of lineItems.data) {
    const price = item.price;
    if (!price || typeof price === "string") {
      continue;
    }

    const lookupKey = typeof price.lookup_key === "string" ? price.lookup_key.trim() : "";
    const resolved = resolveCreditPackIdFromLookupKey(lookupKey);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const context = createRequestContext(request);

  let payload: ConfirmCheckoutRequestBody;
  try {
    payload = (await request.json()) as ConfirmCheckoutRequestBody;
  } catch {
    return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const sessionId = normalizeSessionId(payload.sessionId);
  if (!sessionId || !isValidSessionId(sessionId)) {
    return errorResponse(context, 400, "INVALID_SESSION_ID", "A valid checkout session id is required.");
  }

  const signedInEmail = getCreditEmailFromCookie(request);
  if (!signedInEmail || !isValidEmail(signedInEmail)) {
    return errorResponse(context, 401, "AUTH_REQUIRED", "Log in before confirming checkout.");
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });

    const sessionEmail = getSessionCustomerEmail(session);
    if (!sessionEmail || !isValidEmail(sessionEmail)) {
      return errorResponse(context, 409, "SESSION_EMAIL_MISSING", "Checkout email is unavailable.");
    }

    if (sessionEmail !== signedInEmail) {
      return errorResponse(context, 409, "SESSION_EMAIL_MISMATCH", "Checkout session does not match the signed-in account.");
    }

    if (session.mode === "payment") {
      if (session.payment_status !== "paid") {
        return successJson(context, { ok: false, status: "pending", mode: "credits" });
      }

      const metadataPack = normalizeCreditPackId(session.metadata?.credit_pack_id);
      const metadataLookupPack = resolveCreditPackIdFromLookupKey(session.metadata?.credit_pack_lookup_key);
      const fallbackLineItemPack = session.id ? await resolveCreditPackIdFromSessionLineItems(session.id) : null;
      const packId = metadataPack ?? metadataLookupPack ?? fallbackLineItemPack;
      if (!packId || !session.id) {
        return errorResponse(context, 409, "CREDIT_PACK_NOT_FOUND", "Checkout credits could not be resolved.");
      }

      const customerId = getCustomerId(session.customer);
      const result = await grantCreditsExactlyOnce({
        sessionId: session.id,
        amount: getCreditsForCreditPack(packId),
        customerId,
        email: sessionEmail,
        paymentIntentId: getPaymentIntentId(session.payment_intent as string | Stripe.PaymentIntent | null),
        creditPackId: packId,
        amountTotal: typeof session.amount_total === "number" ? session.amount_total : null,
        currency: typeof session.currency === "string" ? session.currency : null,
        markSessionProcessed: markCreditsSessionProcessed,
        grantCredits,
      });

      const response = successJson(context, {
        ok: true,
        status: "active",
        mode: "credits",
        packId,
        creditsAdded: result.granted ? result.amount : 0,
      });
      response.cookies.set({
        name: CREDIT_SESSION_COOKIE_NAME,
        value: createCreditSessionToken({ email: sessionEmail }),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: CREDIT_SESSION_TTL_SECONDS,
      });
      return response;
    }

    if (session.mode !== "subscription") {
      return errorResponse(context, 409, "SESSION_MODE_UNSUPPORTED", "This checkout session mode is not supported.");
    }

    const isPaymentReady = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!isPaymentReady) {
      return successJson(context, { ok: false, status: "pending", mode: "pro" });
    }

    const subscriptionId = getSessionSubscriptionId(session);
    if (!subscriptionId) {
      return successJson(context, { ok: false, status: "pending", mode: "pro" });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    if (!isActiveProSubscription(subscription)) {
      return successJson(context, { ok: false, status: "pending", mode: "pro" });
    }

    const customerId = getCustomerId(session.customer);
    if (customerId) {
      await upsertAccountEntitlement({
        customerId,
        email: sessionEmail,
        status: "active",
        currentPeriodEnd: getCurrentPeriodEnd(subscription),
      });
    }

    const response = successJson(context, { ok: true, status: "active", mode: "pro", plan: "pro" });
    response.cookies.set({
      name: ENTITLEMENT_SESSION_COOKIE_NAME,
      value: createEntitlementSessionToken({ email: sessionEmail, plan: "pro" }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ENTITLEMENT_SESSION_TTL_SECONDS,
    });
    response.cookies.set({
      name: CREDIT_SESSION_COOKIE_NAME,
      value: createCreditSessionToken({ email: sessionEmail }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CREDIT_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return errorResponse(context, 400, "CHECKOUT_SESSION_NOT_FOUND", "Checkout session was not found.");
    }

    return errorResponse(context, 500, "CHECKOUT_CONFIRM_FAILED", "Unable to confirm checkout right now.");
  }
}
