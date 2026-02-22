import assert from "node:assert/strict";
import test from "node:test";

import {
  FREE_LIMIT_REACHED_CODE,
  SHOW_INTERSTITIAL_ACTION,
  buildFreeLimitReachedPayload,
} from "./evaluateLimitPayload.ts";

test("structured 429 payload matches interstitial contract", () => {
  assert.deepEqual(buildFreeLimitReachedPayload(3), {
    code: FREE_LIMIT_REACHED_CODE,
    action: SHOW_INTERSTITIAL_ACTION,
    freeLimit: 3,
  });
});
