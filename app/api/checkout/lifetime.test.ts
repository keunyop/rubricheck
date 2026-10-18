import assert from "node:assert/strict";
import { after, beforeEach, mock, test } from "node:test";
import type Stripe from "stripe";
import { PRO_LIFETIME_STRIPE_PRICE_ID } from "../../../src/config/proCheckout.ts";

let email: string | null = null;
let activePro = false;
let priceOverrides: Record<string, unknown> = {};
const retrievedPrices: string[] = [];
const checkoutParams: Stripe.Checkout.SessionCreateParams[] = [];
const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const previousStripeKey = process.env.STRIPE_SECRET_KEY;

mock.module("stripe", { defaultExport: class {
  prices = {
    retrieve: async (id: string) => {
      retrievedPrices.push(id);
      return { id, lookup_key: null, active: true, currency: "cad", unit_amount: 9999,
        type: "one_time", product: { id: "prod_lifetime", active: true }, ...priceOverrides };
    },
    list: async () => { throw new Error("Lifetime must retrieve the supplied price ID directly"); },
  };
  customers = { search: async () => ({ data: [] }) };
} });
mock.module("../../../src/lib/creditSession.ts", { namedExports: { getCreditEmailFromCookie: () => email } });
mock.module("../../../src/lib/accountEntitlements.ts", { namedExports: {
  getAccountEntitlementByEmail: async () => activePro ? { plan: "pro" } : null,
  hasAccountEntitlementStore: () => true,
  isActiveProAccountEntitlement: (value: unknown) => Boolean(value),
} });
mock.module("../../../src/lib/entitlementRestore.ts", { namedExports: { resolveActiveEntitlementByVerifiedEmail: async () => null } });
mock.module("../../../src/lib/evaluationCheckout.ts", { namedExports: {
  validateCheckoutEvaluation: async () => null,
  findEvaluationCheckout: async () => null,
  createEvaluationCheckout: async (_stripe: unknown, params: Stripe.Checkout.SessionCreateParams) => {
    checkoutParams.push(params);
    return { id: "cs_lifetime", status: "open", url: "https://checkout.stripe.com/test-lifetime" };
  },
  evaluationCheckoutFields: (appUrl: string) => ({ success_url: appUrl + "/?checkout_session_id={CHECKOUT_SESSION_ID}", cancel_url: appUrl + "/billing/cancel" }),
} });
mock.module("../../../src/lib/abuseTelemetry.ts", { namedExports: {
  getPayloadSizeApprox: () => 0,
  hashEmail: () => "test-email-hash",
  recordAbuseTelemetry: async () => ({ suspicious: false }),
  shouldEnforceForSuspicious: () => false,
} });

const { POST } = await import("./route.ts");
beforeEach(() => {
  email = null; activePro = false; priceOverrides = {};
  retrievedPrices.length = 0; checkoutParams.length = 0;
  process.env.NEXT_PUBLIC_APP_URL = "https://rubricheck.com";
  process.env.STRIPE_SECRET_KEY = "test-only-no-network";
});
after(() => {
  if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousStripeKey;
});

function request(body: Record<string, unknown> = { plan: "lifetime" }) {
  return POST(new Request("http://localhost/api/checkout", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

test("lifetime checkout requires login before contacting Stripe", async () => {
  const response = await request();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_REQUIRED");
  assert.deepEqual(retrievedPrices, []);
});

test("CAD lifetime purchases use the supplied fixed price without requiring a lookup key", async () => {
  email = "student@example.com";
  for (const body of [{ plan: "lifetime" }, { priceId: "pro_lifetime" }]) {
    const response = await request(body);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).plan, "lifetime");
  }
  assert.deepEqual(retrievedPrices, [PRO_LIFETIME_STRIPE_PRICE_ID, PRO_LIFETIME_STRIPE_PRICE_ID]);
  assert.equal(checkoutParams.length, 2);
  for (const params of checkoutParams) {
    assert.equal(params.mode, "payment");
    assert.deepEqual(params.line_items, [{ price: PRO_LIFETIME_STRIPE_PRICE_ID, quantity: 1 }]);
    assert.equal(params.customer_creation, "always");
  }
});

test("incorrect amounts, currencies, recurring prices and archived products cannot start checkout", async () => {
  email = "student@example.com";
  for (const overrides of [
    { unit_amount: 799 }, { currency: "usd" }, { type: "recurring" },
    { active: false }, { product: { id: "prod_lifetime", active: false } },
    { product: { id: "prod_lifetime", deleted: true } },
  ]) {
    priceOverrides = overrides;
    const response = await request();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "LIFETIME_PRICE_INVALID");
  }
  assert.equal(checkoutParams.length, 0);
});

test("existing Pro access prevents another lifetime payment", async () => {
  email = "student@example.com";
  activePro = true;
  const response = await request();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "ALREADY_PRO_ACTIVE");
  assert.equal(checkoutParams.length, 0);
  assert.equal(retrievedPrices.length, 0);
});
