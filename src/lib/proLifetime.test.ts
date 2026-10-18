import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { resolveLifetimeCheckout } from "./proLifetime.ts";
import { isLifetimeEntitlement, LIFETIME_PERIOD_END } from "./proLifetimePolicy.ts";
import { isActiveProEntitlement } from "./entitlementRestoreShared.ts";
import { buildProCheckoutSessionParams } from "./proCheckoutSession.ts";

test("lifetime checkout is one-time and isolates access from recurring subscription events", () => {
  for (const plan of ["monthly", "annual", "lifetime"] as const) {
    const params = buildProCheckoutSessionParams({ plan, priceId: "price_pro", email: "student@example.com",
      appUrl: "https://rubricheck.com", evaluationId: "evaluation_123" });
    assert.equal(params.mode, plan === "lifetime" ? "payment" : "subscription");
    assert.equal(params.customer_creation, plan === "lifetime" ? "always" : undefined);
    assert.equal(params.adaptive_pricing?.enabled, plan === "lifetime" ? false : undefined);
    assert.equal(params.metadata?.evaluation_id, "evaluation_123");
    assert.match(params.success_url ?? "", /evaluation_id=evaluation_123/);
  }
});

function fixture(options: { price?: Record<string, unknown>; session?: Record<string, unknown>; refunded?: boolean; pending?: boolean; multiple?: boolean } = {}) {
  const price = { lookup_key: "pro_lifetime", unit_amount: 9999, currency: "usd", type: "one_time", ...options.price };
  let intentReads = 0;
  const stripe = {
    checkout: { sessions: { listLineItems: async () => ({ has_more: false, data: [{ quantity: 1, price }, ...(options.multiple ? [{ quantity: 1, price }] : [])] }) } },
    paymentIntents: { retrieve: async () => {
      intentReads++;
      return { status: options.pending ? "processing" : "succeeded", currency: "usd", amount_received: 9999,
        latest_charge: { refunded: options.refunded ?? false } };
    } },
  } as unknown as Stripe;
  const session = { id: "cs_lifetime", mode: "payment", status: "complete", payment_status: "paid", customer: "cus_lifetime",
    customer_details: { email: "Student@Example.com" }, payment_intent: "pi_lifetime", currency: "usd", amount_subtotal: 9999,
    metadata: { pro_plan: "lifetime" }, ...options.session } as unknown as Stripe.Checkout.Session;
  return { stripe, session, intentReads: () => intentReads };
}

test("paid lifetime checkout grants non-expiring Pro without trusting plan metadata", async () => {
  const f = fixture({ session: { metadata: {} } });
  const purchase = await resolveLifetimeCheckout(f.stripe, f.session);
  assert.equal(purchase?.email, "student@example.com");
  assert.equal(purchase?.customerId, "cus_lifetime");
  assert.equal(purchase?.entitlement.currentPeriodEnd, LIFETIME_PERIOD_END);
  assert.equal(isLifetimeEntitlement(purchase?.entitlement ?? null), true);
  assert.equal(isActiveProEntitlement(purchase?.entitlement ?? null, 4102444800), true);
});

test("unpaid, incomplete, recurring and incorrectly priced checkouts cannot grant lifetime access", async () => {
  const cases = [
    { session: { payment_status: "unpaid" } }, { session: { status: "open" } }, { session: { mode: "subscription" } },
    { price: { unit_amount: 999 } }, { price: { currency: "cad" } }, { price: { type: "recurring" } },
    { price: { lookup_key: "credits_topup_10" } }, { multiple: true },
  ];
  for (const options of cases) {
    const f = fixture(options);
    assert.equal(await resolveLifetimeCheckout(f.stripe, f.session), null);
    assert.equal(f.intentReads(), 0);
  }
});

test("full refunds revoke access even when an older checkout event is replayed", async () => {
  const f = fixture({ refunded: true });
  for (let i = 0; i < 2; i++) {
    const purchase = await resolveLifetimeCheckout(f.stripe, f.session);
    assert.equal(purchase?.entitlement.status, "canceled");
    assert.equal(isActiveProEntitlement(purchase?.entitlement ?? null, Date.now() / 1000), false);
  }
  assert.equal(f.intentReads(), 2, "Replays must read the current charge state");
});

test("mismatched subtotal and unsettled payments fail before entitlement persistence", async () => {
  const wrongAmount = fixture({ session: { amount_subtotal: 999 } });
  await assert.rejects(resolveLifetimeCheckout(wrongAmount.stripe, wrongAmount.session), /LIFETIME_AMOUNT_INVALID/);
  const pending = fixture({ pending: true });
  await assert.rejects(resolveLifetimeCheckout(pending.stripe, pending.session), /LIFETIME_PAYMENT_NOT_SETTLED/);
});
