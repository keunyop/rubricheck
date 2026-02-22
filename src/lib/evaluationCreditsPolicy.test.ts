import assert from "node:assert/strict";
import test from "node:test";

import { decideFreeEvaluateAccess } from "./evaluationCreditsPolicy.ts";

test("free limit enforcement allows first 3 evaluations from free quota", () => {
  assert.deepEqual(
    decideFreeEvaluateAccess({
      freeCount: 1,
      freeLimit: 3,
      creditsAvailable: 0,
    }),
    { allowed: true, source: "free", consumeCredit: false },
  );

  assert.deepEqual(
    decideFreeEvaluateAccess({
      freeCount: 3,
      freeLimit: 3,
      creditsAvailable: 0,
    }),
    { allowed: true, source: "free", consumeCredit: false },
  );
});

test("after free limit, available credits are consumed for additional evaluations", () => {
  assert.deepEqual(
    decideFreeEvaluateAccess({
      freeCount: 4,
      freeLimit: 3,
      creditsAvailable: 5,
    }),
    { allowed: true, source: "credit", consumeCredit: true },
  );
});

test("after free limit with zero credits, evaluation is blocked", () => {
  assert.deepEqual(
    decideFreeEvaluateAccess({
      freeCount: 4,
      freeLimit: 3,
      creditsAvailable: 0,
    }),
    { allowed: false, source: "blocked", consumeCredit: false, errorCode: "FREE_LIMIT_REACHED" },
  );
});
