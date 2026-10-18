import assert from "node:assert/strict";
import test from "node:test";

import {
  PRO_CHECKOUT_DISPLAY,
  PRO_LIFETIME_STRIPE_PRICE_ID,
  PRO_LIFETIME_CURRENCY,
  buildAnnualSaveNote,
  getLookupKeyForProCheckoutPlan,
  includesProLookupKey,
  isProCheckoutPlanAvailable,
  normalizeProCheckoutPlan,
  resolveProCheckoutPlan,
} from "./proCheckout.ts";

test("getLookupKeyForProCheckoutPlan maps monthly and annual to expected lookup_key", () => {
  assert.equal(getLookupKeyForProCheckoutPlan("monthly"), "pro_monthly");
  assert.equal(getLookupKeyForProCheckoutPlan("annual"), "pro_annual");
});

test("resolveProCheckoutPlan accepts explicit plan parameter", () => {
  assert.equal(resolveProCheckoutPlan({ plan: "monthly" }), "monthly");
  assert.equal(resolveProCheckoutPlan({ plan: "annual" }), "annual");
});

test("resolveProCheckoutPlan supports legacy priceId fallback", () => {
  assert.equal(resolveProCheckoutPlan({ priceId: "pro_monthly" }), "monthly");
  assert.equal(resolveProCheckoutPlan({ priceId: "pro_annual" }), "annual");
});

test("normalizeProCheckoutPlan rejects unknown plan", () => {
  assert.equal(normalizeProCheckoutPlan("weekly"), null);
  assert.equal(normalizeProCheckoutPlan(undefined), null);
});

test("includesProLookupKey returns true for monthly or annual lookup keys", () => {
  assert.equal(includesProLookupKey(["foo", "pro_monthly"]), true);
  assert.equal(includesProLookupKey(["foo", "pro_annual"]), true);
  assert.equal(includesProLookupKey(["foo", "bar"]), false);
});

test("pro checkout display reflects the current monthly and annual pricing", () => {
  assert.equal(PRO_CHECKOUT_DISPLAY.monthly.price, "$7.99");
  assert.equal(PRO_CHECKOUT_DISPLAY.annual.price, "$59.99");
  assert.equal(PRO_CHECKOUT_DISPLAY.annual.saveNote, "Save ~37% vs monthly");
});

test("annual save note is calculated from the actual monthly equivalent", () => {
  assert.equal(buildAnnualSaveNote(799, 5999), "Save ~37% vs monthly");
});

test("lifetime is an available CAD $99.99 one-time plan bound to the supplied Stripe price", () => {
  assert.equal(normalizeProCheckoutPlan("lifetime"), "lifetime");
  assert.equal(resolveProCheckoutPlan({ priceId: "pro_lifetime" }), "lifetime");
  assert.equal(getLookupKeyForProCheckoutPlan("lifetime"), "pro_lifetime");
  assert.equal(PRO_LIFETIME_CURRENCY, "cad");
  assert.equal(PRO_CHECKOUT_DISPLAY.lifetime.price, "CAD $99.99");
  assert.equal(PRO_CHECKOUT_DISPLAY.lifetime.periodLabel, "One-time payment");
  assert.equal(PRO_LIFETIME_STRIPE_PRICE_ID, "price_1URj6hBUXk6e3lrdOBfYg02a");
  assert.equal(isProCheckoutPlanAvailable("lifetime"), true);
  assert.equal(isProCheckoutPlanAvailable("monthly"), true);
  assert.equal(isProCheckoutPlanAvailable("annual"), true);
  assert.equal(includesProLookupKey(["pro_lifetime"]), false, "A lifetime price must never match a recurring subscription");
});
