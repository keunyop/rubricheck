import assert from "node:assert/strict";
import test from "node:test";

import { getEvaluateInterstitialDecision } from "./evaluateInterstitial.ts";

test("UI routes to interstitial when evaluate returns FREE_LIMIT_REACHED", () => {
  const decision = getEvaluateInterstitialDecision({
    status: 429,
    payload: {
      code: "FREE_LIMIT_REACHED",
      action: "SHOW_INTERSTITIAL",
      freeLimit: 3,
    },
    fallbackLimit: 3,
  });

  assert.deepEqual(decision, { show: true, freeLimit: 3 });
});

test("UI does not route to interstitial for unrelated 429 payloads", () => {
  const decision = getEvaluateInterstitialDecision({
    status: 429,
    payload: {
      error: "RATE_LIMITED",
    },
    fallbackLimit: 3,
  });

  assert.deepEqual(decision, { show: false, freeLimit: 3 });
});
