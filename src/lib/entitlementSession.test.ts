import assert from "node:assert/strict";
import test from "node:test";

import {
  createEntitlementSessionToken,
  getPlanFromEntitlementCookie,
  verifyEntitlementSessionToken,
} from "./entitlementSession.ts";

const TEST_SECRET = "test-secret";

function withSessionSecret(run: () => void): void {
  const previousSessionSecret = process.env.ENTITLEMENT_SESSION_SECRET;
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  process.env.ENTITLEMENT_SESSION_SECRET = TEST_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "";

  try {
    run();
  } finally {
    process.env.ENTITLEMENT_SESSION_SECRET = previousSessionSecret;
    process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
  }
}

test("createEntitlementSessionToken and verifyEntitlementSessionToken roundtrip", () => {
  withSessionSecret(() => {
    const token = createEntitlementSessionToken({
      email: "Student@Example.com",
      plan: "pro",
    });

    const payload = verifyEntitlementSessionToken(token);
    assert.ok(payload);
    assert.equal(payload?.email, "student@example.com");
    assert.equal(payload?.plan, "pro");
    assert.equal(typeof payload?.exp, "number");
  });
});

test("verifyEntitlementSessionToken rejects tampered token", () => {
  withSessionSecret(() => {
    const token = createEntitlementSessionToken({
      email: "student@example.com",
      plan: "pro",
    });
    const tampered = `${token}tampered`;

    const payload = verifyEntitlementSessionToken(tampered);
    assert.equal(payload, null);
  });
});

test("getPlanFromEntitlementCookie returns plan only for valid cookie", () => {
  withSessionSecret(() => {
    const token = createEntitlementSessionToken({
      email: "student@example.com",
      plan: "pro",
    });
    const requestWithToken = new Request("http://localhost:3000", {
      headers: {
        cookie: `rubricheck_entitlement=${token}`,
      },
    });

    const requestWithoutToken = new Request("http://localhost:3000");

    assert.equal(getPlanFromEntitlementCookie(requestWithToken), "pro");
    assert.equal(getPlanFromEntitlementCookie(requestWithoutToken), null);
  });
});
