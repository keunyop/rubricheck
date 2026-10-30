import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GradingFailureInput } from "./gradingFailures.ts";

const callbacks: Array<() => Promise<void>> = [];
let calls = 0, fail = false;
mock.module("next/server", { namedExports: { after: (callback: () => Promise<void>) => { callbacks.push(callback); } } });
mock.module("./gradingFailures.ts", { namedExports: { saveGradingFailure: async () => { calls++; if (fail) throw new Error("private input must not be logged"); return "record-id"; } } });
const { queueGradingFailure, gradingFailureCode } = await import("./gradingFailureCapture.ts");
test("capture runs after the response and storage failures cannot escape or log originals", async t => {
  const warnings = t.mock.method(console, "warn", () => {});
  const input = { requestId: "test-request" } as GradingFailureInput;
  queueGradingFailure(input);
  assert.equal(calls, 0);
  await callbacks.shift()!();
  assert.equal(calls, 1);
  fail = true;
  queueGradingFailure(input);
  await callbacks.shift()!();
  assert.deepEqual(warnings.mock.calls[0].arguments, ["GRADING_FAILURE_SAVE_FAILED", { requestId: "test-request" }]);
  assert.equal(gradingFailureCode(new Error("OCR_UNAVAILABLE:assignment"), "FALLBACK"), "OCR_UNAVAILABLE");
  assert.equal(gradingFailureCode(new Error("private input"), "FALLBACK"), "FALLBACK");
});
