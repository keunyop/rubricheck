import assert from "node:assert/strict";
import test from "node:test";

import { canUseCreditsForFeature } from "./evaluationFeatureBilling.ts";

test("credits are only used for evaluate", () => {
  assert.equal(canUseCreditsForFeature("evaluate"), true);
  assert.equal(canUseCreditsForFeature("rewrite"), false);
});
