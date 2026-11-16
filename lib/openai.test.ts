import assert from "node:assert/strict";
import { mock, test } from "node:test";

let calls = 0;
let response: unknown = { output_text: '{"ok":true}' };
const requests: Record<string, unknown>[] = [];
mock.module("openai", { defaultExport: class {
  responses = { create: async (request: Record<string, unknown>) => { calls++; requests.push(request); return response; } };
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

test("evaluation requests JSON output while rubric extraction keeps its existing format", async () => {
  process.env.EVALUATION_MODEL = "test-model";
  process.env.STRUCTURE_MODEL = "test-model";
  response = { status: "completed", output_text: '{"ok":true}' };
  requests.length = 0;
  await callEvaluationModel("Synthetic JSON prompt");
  await callStructureModel("Synthetic JSON prompt");
  assert.deepEqual(requests[0].text, { format: { type: "json_object" } });
  assert.equal(requests[1].text, undefined);
});

test("model output failures retain only bounded diagnostics and reject incomplete or refused JSON", async (t) => {
  process.env.EVALUATION_MODEL = "test-model";
  const cases = [
    { name: "malformed", response: { status: "completed", output_text: '{"private-student-text":' }, reason: "invalid_json", status: "completed", hasText: true, hasRefusal: false, incompleteReason: "none" },
    // A closed nested object must not turn an incomplete evaluation into a successful parse.
    { name: "truncated", response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: '{"ok":true}' }, reason: "incomplete", status: "incomplete", hasText: true, hasRefusal: false, incompleteReason: "max_output_tokens" },
    { name: "filtered", response: { status: "incomplete", incomplete_details: { reason: "content_filter" }, output_text: "" }, reason: "incomplete", status: "incomplete", hasText: false, hasRefusal: false, incompleteReason: "content_filter" },
    { name: "empty", response: { status: "completed", output_text: "  " }, reason: "empty_output", status: "completed", hasText: false, hasRefusal: false, incompleteReason: "none" },
    { name: "refused", response: { status: "completed", output_text: '{"ok":true}', output: [{ type: "message", content: [{ type: "refusal", refusal: "private-refusal-text" }] }] }, reason: "refusal", status: "completed", hasText: true, hasRefusal: true, incompleteReason: "none" },
    { name: "failed", response: { status: "failed", output_text: '{"ok":true}', error: { message: "private-provider-body" } }, reason: "response_failed", status: "failed", hasText: true, hasRefusal: false, incompleteReason: "none" },
    { name: "unknown fields", response: { status: "private-status", incomplete_details: { reason: "private-reason" } }, reason: "empty_output", status: "unknown", hasText: false, hasRefusal: false, incompleteReason: "other" },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      response = item.response;
      await assert.rejects(callEvaluationModel("private-prompt"), error => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "MODEL_JSON_PARSE_FAILED");
        assert.deepEqual((error as Error & { diagnostics: unknown }).diagnostics, {
          reason: item.reason, responseStatus: item.status, incompleteReason: item.incompleteReason,
          hasText: item.hasText, hasRefusal: item.hasRefusal,
        });
        assert.doesNotMatch(JSON.stringify(error), /private-/);
        return true;
      });
    });
  }
  response = { output: [{ content: [{ text: '{"ok":true}' }] }] };
  assert.deepEqual(await callEvaluationModel("Synthetic JSON prompt"), { ok: true });
});
