import assert from "node:assert/strict";
import test from "node:test";

import { grantCreditsExactlyOnce } from "./creditsGrant.ts";

test("webhook grants credits exactly once per checkout session", async () => {
  const processed = new Set<string>();
  let grantedAmount = 0;

  const markSessionProcessed = async (sessionId: string): Promise<boolean> => {
    if (processed.has(sessionId)) {
      return false;
    }

    processed.add(sessionId);
    return true;
  };

  const grantCredits = async (params: { amount: number }): Promise<number> => {
    grantedAmount += params.amount;
    return grantedAmount;
  };

  const first = await grantCreditsExactlyOnce({
    sessionId: "cs_test_once",
    amount: 25,
    email: "student@example.com",
    markSessionProcessed,
    grantCredits,
  });

  const second = await grantCreditsExactlyOnce({
    sessionId: "cs_test_once",
    amount: 25,
    email: "student@example.com",
    markSessionProcessed,
    grantCredits,
  });

  assert.equal(first.granted, true);
  assert.equal(first.amount, 25);
  assert.equal(second.granted, false);
  assert.equal(second.amount, 0);
  assert.equal(grantedAmount, 25);
});
