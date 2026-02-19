import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const PLAN_ALIAS_PRO_MONTHLY = "pro_monthly";

type CheckoutRequestBody = {
  priceId?: unknown;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const requestedPriceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
    if (!requestedPriceId) {
      return NextResponse.json({ error: "MISSING_PRICE_ID" }, { status: 400 });
    }

    if (requestedPriceId !== PLAN_ALIAS_PRO_MONTHLY) {
      return NextResponse.json({ error: "UNKNOWN_PRICE_ID" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) {
      return NextResponse.json({ error: "APP_URL_MISSING" }, { status: 500 });
    }

    const priceResult = await getStripeClient().prices.list({
      lookup_keys: [PLAN_ALIAS_PRO_MONTHLY],
      active: true,
      limit: 1,
    });
    const proMonthlyStripePriceId = priceResult.data[0]?.id;
    if (!proMonthlyStripePriceId) {
      return NextResponse.json({ error: "STRIPE_PRICE_NOT_FOUND" }, { status: 500 });
    }

    const session = await getStripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: proMonthlyStripePriceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success`,
      cancel_url: `${appUrl}/billing/cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "CHECKOUT_SESSION_URL_MISSING" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    console.error("CHECKOUT_SESSION_FAILED", error);
    return NextResponse.json({ error: "CHECKOUT_SESSION_FAILED" }, { status: 500 });
  }
}
