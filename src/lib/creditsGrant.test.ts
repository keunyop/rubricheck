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

  const applied = new Set<string>();
  const grantCredits = async (params: { amount: number; checkoutSessionId?: string | null }): Promise<number> => {
    if (applied.has(params.checkoutSessionId!)) return grantedAmount;
    applied.add(params.checkoutSessionId!);
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

for (const failAfterApply of [false, true]) {
  test("purchase grant retries after failure (applied=" + failAfterApply + ") without loss or duplication", async () => {
    const applied = new Set<string>(); const marked = new Set<string>(); let balance = 0; let attempts = 0;
    const params = {
      sessionId: "cs_retry", amount: 25, email: "student@example.com",
      markSessionProcessed: async (id: string) => { const first = !marked.has(id); marked.add(id); return first; },
      grantCredits: async (input: { amount: number; checkoutSessionId?: string | null }) => {
        attempts++;
        if (attempts === 1 && !failAfterApply) throw new Error("network");
        if (!applied.has(input.checkoutSessionId!)) { applied.add(input.checkoutSessionId!); balance += input.amount; }
        if (attempts === 1) throw new Error("response lost");
        return balance;
      },
    };
    await assert.rejects(grantCreditsExactlyOnce(params));
    assert.equal(marked.size, 0);
    await Promise.all([grantCreditsExactlyOnce(params), grantCreditsExactlyOnce(params)]);
    assert.equal(balance, 25); assert.equal(marked.size, 1);
  });
}
