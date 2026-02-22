import assert from "node:assert/strict";
import test from "node:test";

import {
  getLookupKeyForProCheckoutPlan,
  includesProLookupKey,
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
