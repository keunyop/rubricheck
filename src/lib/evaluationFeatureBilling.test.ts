import assert from "node:assert/strict";
import test from "node:test";

import { canUseCreditsForFeature } from "./evaluationFeatureBilling.ts";

test("credits are never used for simulate or rewrite", () => {
  assert.equal(canUseCreditsForFeature("evaluate"), true);
  assert.equal(canUseCreditsForFeature("simulate"), false);
  assert.equal(canUseCreditsForFeature("rewrite"), false);
});
