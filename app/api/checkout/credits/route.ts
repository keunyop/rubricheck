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

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  try {
    const body = (await request.json()) as CreditCheckoutRequestBody;
    const packId = normalizeCreditPackId(body.packId);
    const email = normalizeEmail(body.email);

    if (!packId) return errorResponse(context, 400, "INVALID_PACK_ID", "Selected credit pack is invalid.");
    if (!email) return errorResponse(context, 400, "MISSING_EMAIL", "Email is required.");
    if (!isValidEmail(email)) return errorResponse(context, 400, "INVALID_EMAIL", "Email address is invalid.");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) return errorResponse(context, 500, "APP_URL_MISSING", "Checkout is not configured.");

    const lookupKey = getLookupKeyForCreditPack(packId);
    const priceResult = await getStripeClient().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const stripePriceId = priceResult.data[0]?.id;
    if (!stripePriceId) return errorResponse(context, 500, "STRIPE_PRICE_NOT_FOUND", "Checkout price is unavailable.");

    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: email,
      customer_creation: "always",
      success_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: {
        purchase_type: "credits",
        credit_pack_id: packId,
        credit_pack_lookup_key: lookupKey,
      },
    });

    if (!session.url) return errorResponse(context, 500, "CHECKOUT_SESSION_URL_MISSING", "Checkout session is unavailable.");

    const response = NextResponse.json({ url: session.url, packId }, { headers: { "x-request-id": context.requestId } });
    response.cookies.set({
      name: CREDIT_SESSION_COOKIE_NAME,
      value: createCreditSessionToken({ email }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CREDIT_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
    console.error("CREDIT_CHECKOUT_SESSION_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "CREDIT_CHECKOUT_SESSION_FAILED", "Unable to start credit checkout right now.");
  }
}
