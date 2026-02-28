import assert from "node:assert/strict";
import test from "node:test";

import { buildCreditCheckoutSessionParams } from "../../../../src/lib/creditCheckoutSession.ts";

test("credit checkout reuses an existing Stripe customer when available", () => {
  const params = buildCreditCheckoutSessionParams({
    priceId: "price_123",
    appUrl: "https://example.com",
    email: "student@example.com",
    packId: "topup_25",
    lookupKey: "credits_topup_25",
    customerId: "cus_existing",
  });

  assert.equal(params.customer, "cus_existing");
  assert.equal(params.customer_email, undefined);
  assert.equal(params.customer_creation, undefined);
});

test("credit checkout creates a customer only when no prior Stripe customer exists", () => {
  const params = buildCreditCheckoutSessionParams({
    priceId: "price_123",
    appUrl: "https://example.com",
    email: "student@example.com",
    packId: "topup_25",
    lookupKey: "credits_topup_25",
    customerId: null,
  });

  assert.equal(params.customer, undefined);
  assert.equal(params.customer_email, "student@example.com");
  assert.equal(params.customer_creation, "always");
});
