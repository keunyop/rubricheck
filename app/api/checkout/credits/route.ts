import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  getLookupKeyForCreditPack,
  normalizeCreditPackId,
} from "../../../../src/config/creditPacks";
import {
  CREDIT_SESSION_COOKIE_NAME,
  CREDIT_SESSION_TTL_SECONDS,
  createCreditSessionToken,
} from "../../../../src/lib/creditSession";
import { createRequestContext, errorResponse } from "../../../../src/lib/apiError";
import {
  getPayloadSizeApprox,
  hashEmail,
  recordAbuseTelemetry,
  shouldEnforceForSuspicious,
} from "../../../../src/lib/abuseTelemetry";
import { buildCreditCheckoutSessionParams } from "../../../../src/lib/creditCheckoutSession";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getCustomerIdByEmail } from "../../../../src/lib/entitlement";

export const runtime = "nodejs";

type CreditCheckoutRequestBody = {
  packId?: unknown;
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

type StripeLikeError = {
  param?: unknown;
  message?: unknown;
  code?: unknown;
  type?: unknown;
};

function asStripeLikeError(error: unknown): StripeLikeError | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  return error as StripeLikeError;
}

function shouldRetryWithoutCustomerCreation(error: unknown): boolean {
  const stripeError = asStripeLikeError(error);
  if (!stripeError) {
    return false;
  }

  if (stripeError.param === "customer_creation") {
    return true;
  }

  const message = typeof stripeError.message === "string" ? stripeError.message.toLowerCase() : "";
  return message.includes("customer_creation");
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findExistingStripeCustomerId(email: string): Promise<string | null> {
  const mappedCustomerId = await getCustomerIdByEmail(email);
  if (mappedCustomerId) {
    return mappedCustomerId;
  }

  const stripe = getStripeClient();
  try {
    const searchResult = await stripe.customers.search({
      query: `email:'${escapeStripeSearchValue(email)}'`,
      limit: 10,
    });

    const customerId = searchResult.data
      .map((customer) => customer.id.trim())
      .find((value) => value.length > 0);

    return customerId ?? null;
  } catch {
    const listResult = await stripe.customers.list({
      email,
      limit: 10,
    });

    const customerId = listResult.data
      .map((customer) => customer.id.trim())
      .find((value) => value.length > 0);

    return customerId ?? null;
  }
}

function shouldRetryWithoutPinnedCustomer(error: unknown): boolean {
  const stripeError = asStripeLikeError(error);
  if (!stripeError) {
    return false;
  }

  if (stripeError.param === "customer") {
    return true;
  }

  const code = typeof stripeError.code === "string" ? stripeError.code.toLowerCase() : "";
  const message = typeof stripeError.message === "string" ? stripeError.message.toLowerCase() : "";
  return code.includes("customer") || message.includes("no such customer") || message.includes("customer");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    const body = (await request.json()) as CreditCheckoutRequestBody;
    const packId = normalizeCreditPackId(body.packId);
    const bodyEmail = normalizeEmail(body.email);
    const signedInEmail = getCreditEmailFromCookie(request);
    requestEmail = signedInEmail ?? bodyEmail;

    if (!packId) return respond(errorResponse(context, 400, "INVALID_PACK_ID", "Selected credit pack is invalid."), "error");
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

    const lookupKey = getLookupKeyForCreditPack(packId);
    const priceResult = await getStripeClient().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const stripePriceId = priceResult.data[0]?.id;
    if (!stripePriceId) return respond(errorResponse(context, 500, "STRIPE_PRICE_NOT_FOUND", "Checkout price is unavailable."), "error");

    const stripe = getStripeClient();
    const existingCustomerId = await findExistingStripeCustomerId(requestEmail);
    const sessionParams = buildCreditCheckoutSessionParams({
      priceId: stripePriceId,
      appUrl,
      email: requestEmail,
      packId,
      lookupKey,
      customerId: existingCustomerId,
    });

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (sessionError) {
      if (sessionParams.customer && shouldRetryWithoutPinnedCustomer(sessionError)) {
        console.warn("CREDIT_CHECKOUT_CUSTOMER_REUSE_FAILED", {
          requestId: context.requestId,
          customerId: sessionParams.customer,
        });
        session = await stripe.checkout.sessions.create(
          buildCreditCheckoutSessionParams({
            priceId: stripePriceId,
            appUrl,
            email: requestEmail,
            packId,
            lookupKey,
            customerId: null,
          }),
        );
      } else if (!shouldRetryWithoutCustomerCreation(sessionError)) {
        throw sessionError;
      } else {
        console.warn("CREDIT_CHECKOUT_CUSTOMER_CREATION_UNSUPPORTED", {
          requestId: context.requestId,
        });
        session = await stripe.checkout.sessions.create({
          ...buildCreditCheckoutSessionParams({
            priceId: stripePriceId,
            appUrl,
            email: requestEmail,
            packId,
            lookupKey,
            customerId: null,
          }),
          customer_creation: undefined,
        });
      }
    }

    if (!session.url) return respond(errorResponse(context, 500, "CHECKOUT_SESSION_URL_MISSING", "Checkout session is unavailable."), "error");

    const response = NextResponse.json({ url: session.url, packId }, { headers: { "x-request-id": context.requestId } });
    response.cookies.set({
      name: CREDIT_SESSION_COOKIE_NAME,
      value: createCreditSessionToken({ email: requestEmail }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CREDIT_SESSION_TTL_SECONDS,
    });
    return respond(response, "success");
  } catch (error) {
    if (error instanceof SyntaxError) return respond(errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON."), "error");
    const stripeError = asStripeLikeError(error);
    console.error("CREDIT_CHECKOUT_SESSION_FAILED", {
      requestId: context.requestId,
      error,
      emailHash: hashEmail(requestEmail),
      stripeError:
        stripeError
          ? {
              type: typeof stripeError.type === "string" ? stripeError.type : null,
              code: typeof stripeError.code === "string" ? stripeError.code : null,
              param: typeof stripeError.param === "string" ? stripeError.param : null,
              message: typeof stripeError.message === "string" ? stripeError.message : null,
            }
          : null,
    });
    return respond(errorResponse(context, 500, "CREDIT_CHECKOUT_SESSION_FAILED", "Unable to start credit checkout right now."), "error");
  }
}
