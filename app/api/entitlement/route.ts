import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  getEntitlementByEmail,
  setCustomerIdByEmail,
  setEntitlementForCustomer,
  type EntitlementRecord,
} from "../../../src/lib/entitlement";
import {
  ENTITLEMENT_SESSION_COOKIE_NAME,
  ENTITLEMENT_SESSION_TTL_SECONDS,
  createEntitlementSessionToken,
  getPlanFromEntitlementCookie,
} from "../../../src/lib/entitlementSession";

export const runtime = "nodejs";

type EntitlementRequestBody = {
  email?: unknown;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

function getCurrentPeriodEnd(subscription: Stripe.Subscription): number {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));

  if (periodEnds.length > 0) {
    return Math.max(...periodEnds);
  }

  return subscription.cancel_at ?? subscription.ended_at ?? Math.floor(Date.now() / 1000);
}

function mapSubscriptionToEntitlement(subscription: Stripe.Subscription): EntitlementRecord {
  const status =
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
      ? "canceled"
      : "active";

  return {
    plan: "pro",
    status,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  };
}

function isActiveEntitlement(entitlement: EntitlementRecord | null): boolean {
  if (!entitlement) {
    return false;
  }

  if (entitlement.plan !== "pro" || entitlement.status !== "active") {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return entitlement.currentPeriodEnd >= nowSeconds;
}

async function tryBackfillEntitlementFromStripe(email: string): Promise<EntitlementRecord | null> {
  const customers = await getStripeClient().customers.list({
    email,
    limit: 1,
  });
  const customer = customers.data[0];
  if (!customer) {
    return null;
  }

  const customerId = customer.id.trim();
  if (!customerId) {
    return null;
  }

  const subscriptions = await getStripeClient().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const activeCandidate = subscriptions.data
    .map((subscription) => mapSubscriptionToEntitlement(subscription))
    .filter((entitlement) => isActiveEntitlement(entitlement))
    .sort((a, b) => b.currentPeriodEnd - a.currentPeriodEnd)[0];

  if (!activeCandidate) {
    return null;
  }

  await Promise.all([
    setCustomerIdByEmail(email, customerId),
    setEntitlementForCustomer(customerId, activeCandidate),
  ]);

  return activeCandidate;
}

export async function POST(request: Request) {
  let payload: EntitlementRequestBody;

  try {
    payload = (await request.json()) as EntitlementRequestBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  }

  try {
    let entitlement = await getEntitlementByEmail(email);

    // Webhook sync might be delayed. If Redis has no active entitlement yet, fetch from Stripe and backfill.
    if (!isActiveEntitlement(entitlement)) {
      entitlement = await tryBackfillEntitlementFromStripe(email);
    }

    if (!entitlement) {
      return NextResponse.json({ error: "ENTITLEMENT_NOT_FOUND" }, { status: 404 });
    }

    if (entitlement.plan !== "pro" || entitlement.status !== "active") {
      return NextResponse.json({ error: "PRO_NOT_ACTIVE" }, { status: 403 });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (entitlement.currentPeriodEnd < nowSeconds) {
      return NextResponse.json({ error: "PRO_EXPIRED" }, { status: 403 });
    }

    const token = createEntitlementSessionToken({ email, plan: "pro" });
    const response = NextResponse.json({ ok: true, plan: "pro" });

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
    if (error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING") {
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    if (error instanceof Error && error.message === "ENTITLEMENT_SESSION_SECRET_MISSING") {
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }
    if (error instanceof Error && error.message === "STRIPE_SECRET_KEY_MISSING") {
      return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
    }

    console.error("ENTITLEMENT_ACTIVATION_FAILED", error);
    return NextResponse.json({ error: "ENTITLEMENT_ACTIVATION_FAILED" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const plan = getPlanFromEntitlementCookie(request) ?? "free";
  return NextResponse.json({ plan });
}
