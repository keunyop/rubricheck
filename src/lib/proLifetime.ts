import type Stripe from "stripe";
import { getAccountEntitlementByEmail, hasAccountEntitlementStore, upsertAccountEntitlement } from "./accountEntitlements";
import { setCachedStripeLookupByEmail, setCustomerIdByEmail, setEntitlementForCustomer, type EntitlementRecord } from "./entitlement";
import { isLifetimeEntitlement, isLifetimeLineItems, LIFETIME_PERIOD_END } from "./proLifetimePolicy";
import { PRO_LIFETIME_PRICE_CENTS } from "../config/proCheckout";

export type LifetimeCheckout = {
  customerId: string;
  email: string;
  entitlement: EntitlementRecord;
};

// Use Stripe's current charge state, including on replayed checkout webhooks,
// so a refunded purchase cannot grant lifetime access again.
export async function resolveLifetimeCheckout(stripe: Stripe, session: Stripe.Checkout.Session): Promise<LifetimeCheckout | null> {
  if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") return null;
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ["data.price"] });
  if (items.has_more || !isLifetimeLineItems(items.data)) return null;
  if (session.currency !== "usd" || session.amount_subtotal !== PRO_LIFETIME_PRICE_CENTS) {
    throw new Error("LIFETIME_AMOUNT_INVALID");
  }
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const email = (session.customer_details?.email ?? session.customer_email)?.trim().toLowerCase();
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!customerId || !email || !paymentIntentId) throw new Error("LIFETIME_PURCHASE_INCOMPLETE");
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const charge = intent.latest_charge;
  if (intent.status !== "succeeded" || intent.currency !== "usd" || intent.amount_received < PRO_LIFETIME_PRICE_CENTS ||
    !charge || typeof charge === "string") throw new Error("LIFETIME_PAYMENT_NOT_SETTLED");
  const active = !charge.refunded;
  return {
    customerId,
    email,
    entitlement: {
      plan: "pro", status: active ? "active" : "canceled",
      currentPeriodEnd: active ? LIFETIME_PERIOD_END : 0,
      updatedAt: Math.floor(Date.now() / 1000),
    },
  };
}

export async function persistLifetimeCheckout(purchase: LifetimeCheckout): Promise<void> {
  if (!hasAccountEntitlementStore()) throw new Error("LIFETIME_STORE_UNAVAILABLE");
  await upsertAccountEntitlement({ customerId: purchase.customerId, email: purchase.email,
    status: purchase.entitlement.status === "active" ? "active" : "canceled", currentPeriodEnd: purchase.entitlement.currentPeriodEnd });
  const best = await getAccountEntitlementByEmail(purchase.email);
  if (!best || (purchase.entitlement.status === "active" && !isLifetimeEntitlement(best)) ||
    (purchase.entitlement.status === "canceled" && best.customerId === purchase.customerId && isLifetimeEntitlement(best))) {
    throw new Error("LIFETIME_STORE_UNAVAILABLE");
  }
  await setEntitlementForCustomer(purchase.customerId, purchase.entitlement);
  await setCustomerIdByEmail(purchase.email, purchase.customerId);
  // Clear an earlier negative/subscription cache. On refund another customer's
  // subscription may still be active, so resolve the best durable entitlement.
  await setCachedStripeLookupByEmail(purchase.email, {
    customerId: best?.customerId ?? purchase.customerId,
    entitlement: best ? { ...best, updatedAt: best.updatedAt ?? purchase.entitlement.updatedAt } : null,
    checkedAt: Math.floor(Date.now() / 1000),
  }, 300);
}

export async function findLifetimeCheckoutByCustomer(stripe: Stripe, customerId: string): Promise<LifetimeCheckout | null> {
  // Auto-pagination also finds purchases older than the first page of sessions.
  for await (const session of stripe.checkout.sessions.list({ customer: customerId, status: "complete", limit: 100 })) {
    const purchase = await resolveLifetimeCheckout(stripe, session);
    if (purchase?.entitlement.status === "active") return purchase;
  }
  return null;
}
