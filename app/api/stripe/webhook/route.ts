import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  setCustomerIdByEmail,
  setEntitlementForCustomer,
  type EntitlementRecord,
} from "../../../../src/lib/entitlement";
import { includesProLookupKey } from "../../../../src/config/proCheckout";
import { grantCredits, markCreditsSessionProcessed } from "../../../../src/lib/credits";
import { grantCreditsExactlyOnce } from "../../../../src/lib/creditsGrant";
import {
  getCreditsForCreditPack,
  normalizeCreditPackId,
  resolveCreditPackIdFromLookupKey,
  type CreditPackId,
} from "../../../../src/config/creditPacks";

export const runtime = "nodejs";

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

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET_MISSING");
  }

  return secret;
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

async function resolveCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const customer = await getStripeClient().customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return null;
    }

    const email = customer.email?.trim().toLowerCase();
    return email || null;
  } catch {
    return null;
  }
}

function normalizeEntitlementStatus(status: Stripe.Subscription.Status): "active" | "canceled" {
  return status === "active" || status === "trialing" ? "active" : "canceled";
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

function isProSubscription(subscription: Stripe.Subscription): boolean {
  return includesProLookupKey(getSubscriptionLookupKeys(subscription));
}

async function retrieveSubscriptionWithPrices(subscriptionId: string): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

function mapSubscriptionToEntitlement(subscription: Stripe.Subscription): EntitlementRecord {
  return {
    plan: "pro",
    status: normalizeEntitlementStatus(subscription.status),
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

async function persistEntitlement(params: {
  customerId: string;
  entitlement: EntitlementRecord;
  email?: string | null;
}): Promise<void> {
  const ops: Promise<void>[] = [setEntitlementForCustomer(params.customerId, params.entitlement)];

  const normalizedEmail = params.email?.trim().toLowerCase();
  if (normalizedEmail) {
    ops.push(setCustomerIdByEmail(normalizedEmail, params.customerId));
  }

  await Promise.all(ops);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const sessionEmail = session.customer_details?.email ?? session.customer_email ?? null;
  const customerId = getCustomerId(session.customer);
  const mode = session.mode;

  if (mode === "payment") {
    if (session.payment_status !== "paid") {
      return;
    }

    if (!session.id) {
      return;
    }

    const metadataPack = normalizeCreditPackId(session.metadata?.credit_pack_id);
    const metadataLookupPack = resolveCreditPackIdFromLookupKey(session.metadata?.credit_pack_lookup_key);
    const fallbackLineItemPack = await resolveCreditPackIdFromSessionLineItems(session.id);
    const packId = metadataPack ?? metadataLookupPack ?? fallbackLineItemPack;

    if (!packId) {
      return;
    }

    await grantCreditsExactlyOnce({
      sessionId: session.id,
      amount: getCreditsForCreditPack(packId),
      customerId,
      email: sessionEmail,
      markSessionProcessed: markCreditsSessionProcessed,
      grantCredits,
    });
    return;
  }

  if (!customerId) {
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (subscriptionId) {
    const subscription = await retrieveSubscriptionWithPrices(subscriptionId);
    if (!isProSubscription(subscription)) {
      return;
    }
    await persistEntitlement({
      customerId,
      entitlement: mapSubscriptionToEntitlement(subscription),
      email: sessionEmail,
    });
    return;
  }
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
  const hydratedSubscription = await retrieveSubscriptionWithPrices(subscription.id);
  if (!isProSubscription(hydratedSubscription)) {
    return;
  }

  const customerId = getCustomerId(hydratedSubscription.customer);
  if (!customerId) {
    return;
  }

  const customerEmail = await resolveCustomerEmail(customerId);
  await persistEntitlement({
    customerId,
    entitlement: mapSubscriptionToEntitlement(hydratedSubscription),
    email: customerEmail,
  });
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
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "STRIPE_SIGNATURE_MISSING" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (error) {
    console.error("STRIPE_WEBHOOK_SIGNATURE_INVALID", error);
    return NextResponse.json({ error: "STRIPE_SIGNATURE_INVALID" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("STRIPE_WEBHOOK_PROCESSING_FAILED", { eventType: event.type, error });
    return NextResponse.json({ error: "STRIPE_WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
