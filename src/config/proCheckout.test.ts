import assert from "node:assert/strict";
import test from "node:test";

import {
  PRO_CHECKOUT_DISPLAY,
  buildAnnualSaveNote,
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

test("pro checkout display reflects the current monthly and annual pricing", () => {
  assert.equal(PRO_CHECKOUT_DISPLAY.monthly.price, "$7.99");
  assert.equal(PRO_CHECKOUT_DISPLAY.annual.price, "$59.99");
  assert.equal(PRO_CHECKOUT_DISPLAY.annual.saveNote, "Save ~37% vs monthly");
});

test("annual save note is calculated from the actual monthly equivalent", () => {
  assert.equal(buildAnnualSaveNote(799, 5999), "Save ~37% vs monthly");
});
