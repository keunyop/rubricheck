import assert from "node:assert/strict";
import test from "node:test";

import { isActiveProEntitlement, isValidEmail, normalizeEmailInput } from "./entitlementRestoreShared.ts";

type EntitlementRecord = {
  plan: string;
  status: string;
  currentPeriodEnd: number;
  updatedAt: number;
};

function buildEntitlement(overrides?: Partial<EntitlementRecord>): EntitlementRecord {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    plan: "pro",
    status: "active",
    currentPeriodEnd: nowSeconds + 3600,
    updatedAt: nowSeconds,
    ...overrides,
  };
}

test("normalizeEmailInput trims and lowercases", () => {
  assert.equal(normalizeEmailInput(" Student@Example.com "), "student@example.com");
  assert.equal(normalizeEmailInput(42), "");
});

test("isValidEmail validates expected shapes", () => {
  assert.equal(isValidEmail("student@example.com"), true);
  assert.equal(isValidEmail("invalid-email"), false);
  assert.equal(isValidEmail(""), false);
});

test("isActiveEntitlement only accepts active non-expired pro entitlement", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  assert.equal(isActiveProEntitlement(buildEntitlement(), nowSeconds), true);
  assert.equal(
    isActiveProEntitlement(
      buildEntitlement({
        status: "canceled",
      }),
      nowSeconds,
    ),
    false,
  );
  assert.equal(
    isActiveProEntitlement(
      buildEntitlement({
        currentPeriodEnd: nowSeconds - 1,
      }),
      nowSeconds,
    ),
    false,
  );
  assert.equal(isActiveProEntitlement(null, nowSeconds), false);
});
