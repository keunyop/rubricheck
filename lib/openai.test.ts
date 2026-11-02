import assert from "node:assert/strict";
import { mock, test } from "node:test";

let calls = 0;
mock.module("openai", { defaultExport: class {
  responses = { create: async () => { calls++; return { output_text: '{"ok":true}' }; } };
} });
process.env.OPENAI_API_KEY = "test-only";
const { callEvaluationModel, callStructureModel } = await import("./openai.ts");

test("evaluation and rubric extraction retries use the original deadline and cannot start after it expires", async (t) => {
  const previousEnv = { ...process.env };
  const delays: number[] = [];
  const realSetTimeout = globalThis.setTimeout;
  let now = 100_000;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "setTimeout", (callback: () => void, ms: number) => {
    delays.push(ms);
    return realSetTimeout(callback, ms);
  });
  process.env.OPENAI_TIMEOUT_MS = "30000";
  process.env.EVALUATION_MODEL = "test-model";
  process.env.STRUCTURE_MODEL = "test-model";
  try {
    for (const caller of [callEvaluationModel, callStructureModel]) {
      const previousCalls = calls;
      delays.length = 0; now = 100_000;
      await caller("Synthetic prompt", { startedAt: 100_000 });
      now = 120_000;
      await caller("Synthetic retry", { startedAt: 100_000 });
      assert.deepEqual(delays, [30_000, 10_000]);
      now = 130_000;
      await assert.rejects(caller("Expired retry", { startedAt: 100_000 }), /OPENAI_TIMEOUT/);
      assert.equal(calls - previousCalls, 2);
    }
  } finally { process.env = previousEnv; }
});
