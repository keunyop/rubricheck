import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import type Stripe from "stripe";

const priceLookups: string[] = [];
const checkoutParams: Stripe.Checkout.SessionCreateParams[] = [];
const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const previousStripeKey = process.env.STRIPE_SECRET_KEY;

mock.module("stripe", { defaultExport: class {
  prices = { list: async (params: { lookup_keys: string[] }) => {
    const key = params.lookup_keys[0];
    priceLookups.push(key);
    const prices: Record<string, string> = {
      credits_10_usd_v1: "price_1UXw9jBUXk6e3lrd3kCpjhTf",
      credits_25_usd_v1: "price_1UXwAHBUXk6e3lrdSTg2EdrA",
      credits_60_usd_v1: "price_1UXwB1BUXk6e3lrd8NHNaBHK",
    };
    return { data: prices[key] ? [{ id: prices[key] }] : [] };
  } };
  customers = { search: async () => ({ data: [] }) };
} });
mock.module("../../../../src/lib/creditSession.ts", { namedExports: {
  getCreditEmailFromCookie: () => "student@example.com",
  CREDIT_SESSION_COOKIE_NAME: "rubricheck_credit_session",
  CREDIT_SESSION_TTL_SECONDS: 3600,
  createCreditSessionToken: () => "test-session",
} });
mock.module("../../../../src/lib/entitlement.ts", { namedExports: {
  getCustomerIdByEmail: async () => null,
} });
mock.module("../../../../src/lib/evaluationCheckout.ts", { namedExports: {
  validateCheckoutEvaluation: async () => null,
  createEvaluationCheckout: async (_stripe: unknown, params: Stripe.Checkout.SessionCreateParams) => {
    checkoutParams.push(params);
    return { id: "cs_credits", status: "open", url: "https://checkout.stripe.com/test-credits" };
  },
  evaluationCheckoutFields: (appUrl: string) => ({
    success_url: appUrl + "/?checkout_session_id={CHECKOUT_SESSION_ID}",
    cancel_url: appUrl + "/billing/cancel",
  }),
} });
mock.module("../../../../src/lib/abuseTelemetry.ts", { namedExports: {
  getPayloadSizeApprox: () => 0,
  hashEmail: () => "test-email-hash",
  recordAbuseTelemetry: async () => ({ suspicious: false }),
  shouldEnforceForSuspicious: () => false,
} });

const { POST } = await import("./route.ts");
beforeEach(() => {
  priceLookups.length = 0;
  checkoutParams.length = 0;
  process.env.NEXT_PUBLIC_APP_URL = "https://rubricheck.com";
  process.env.STRIPE_SECRET_KEY = "test-only-no-network";
});
after(() => {
  if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousStripeKey;
});

test("all credit packs select the supplied USD prices and carry their keys into fulfillment metadata", async () => {
  for (const packId of ["10", "25", "60"]) {
    const response = await POST(new Request("https://rubricheck.com/api/checkout/credits", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId }),
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).url, "https://checkout.stripe.com/test-credits");
  }
  assert.deepEqual(priceLookups, ["credits_10_usd_v1", "credits_25_usd_v1", "credits_60_usd_v1"]);
  assert.deepEqual(checkoutParams.map(params => params.line_items), [
    [{ price: "price_1UXw9jBUXk6e3lrd3kCpjhTf", quantity: 1 }],
    [{ price: "price_1UXwAHBUXk6e3lrdSTg2EdrA", quantity: 1 }],
    [{ price: "price_1UXwB1BUXk6e3lrd8NHNaBHK", quantity: 1 }],
  ]);
  for (const [index, params] of checkoutParams.entries()) {
    assert.equal(params.mode, "payment");
    assert.equal(params.currency, "usd");
    assert.equal(params.adaptive_pricing?.enabled, false);
    assert.equal(params.metadata?.credit_pack_lookup_key, priceLookups[index]);
    assert.equal(params.payment_intent_data?.metadata?.credit_pack_lookup_key, priceLookups[index]);
  }
});
