import assert from "node:assert/strict";
import test from "node:test";

import { shouldRefundReservedEvaluateCredit } from "./evaluationCreditSettlement.ts";

test("credit decrement occurs only on successful evaluation", () => {
  assert.equal(
    shouldRefundReservedEvaluateCredit({
      billingSource: "credit",
      hasReservation: true,
      evaluationSucceeded: true,
    }),
    false,
  );

  assert.equal(
    shouldRefundReservedEvaluateCredit({
      billingSource: "credit",
      hasReservation: true,
      evaluationSucceeded: false,
    }),
    true,
  );
});

test("simulate/rewrite style non-credit billing never trigger credit refund logic", () => {
  assert.equal(
    shouldRefundReservedEvaluateCredit({
      billingSource: "free",
      hasReservation: false,
      evaluationSucceeded: false,
    }),
    false,
  );

  assert.equal(
    shouldRefundReservedEvaluateCredit({
      billingSource: "pro",
      hasReservation: false,
      evaluationSucceeded: false,
    }),
    false,
  );
});
