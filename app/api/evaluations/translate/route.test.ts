import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { resultTextFields } from "../../../../lib/resultTranslation.ts";
import type { FinalEvaluation } from "../../../../lib/gradeFinalization.ts";
const id = "11111111-1111-4111-8111-111111111111";
let email: string | null = "student@example.com", calls = 0, rate = 0, pending = false, failModel = false;
let lastPrompt = "";
const stored = new Map<string, unknown>();
const original: FinalEvaluation = { language: "en", title: "Essay", access_tier: "free", overall_range: [70, 80],
  summary: "Summary", top_improvements: ["Visible improvement", "SECRET_IMPROVEMENT", "SECRET_THIRD"],
  criteria: [{ name: "Argument", score: 75, max_score: 100, estimated_range: [70, 80], rationale: "Rationale", feedback: "Feedback",
    evidence: ["Exact quote"], detailed_breakdown: "SECRET_DETAIL", example_revisions: ["SECRET_REWRITE"] }] };
const guest = { guest_preview: true as const, title: "Trial", overall_range: [50, 60], summary: "Guest summary" };
mock.module("../../../../src/lib/creditSession.ts", { namedExports: { getCreditEmailFromCookie: () => email } });
mock.module("../../../../src/lib/assignmentWorkspace.ts", { namedExports: {
  getArchivedAssignment: async (owner: string, evaluationId: string) => owner === "student@example.com" && evaluationId === id ? { result: original } : null,
} });
mock.module("../../../../src/lib/evaluationRecovery.ts", { namedExports: {
  normalizeEvaluationId: (value: string) => /^[a-f0-9-]{36}$/.test(value) ? value : null,
  ownerHash: (value: string) => value, getEvaluation: async () => null,
  recoveryRedis: () => ({
    get: async (key: string) => stored.get(key),
    set: async (key: string, value: unknown, options: { nx?: boolean }) => {
      if (options?.nx && pending) return null;
      stored.set(key, value); return "OK";
    },
    eval: async (script: string, keys: string[]) => {
      if (script.includes("INCR")) return ++rate;
      stored.delete(keys[0]); return 1;
    },
  }),
} });
mock.module("../../../../src/lib/guestTrial.ts", { namedExports: { trialIdentity: () => ({ token: "guest-owner" }), readTrial: async () => ({ result: guest }) } });
mock.module("../../../../lib/openai.ts", { namedExports: { callEvaluationModel: async (prompt: string) => {
  calls++; lastPrompt = prompt;
  if (failModel) throw Error("offline");
  const fields = JSON.parse(prompt.split("Strings to translate:\n")[1]) as string[];
  return { translations: fields.map(text => "번역 " + text) };
} } });
const { POST } = await import("./route.ts");
const request = (language: string, evaluationId: string | undefined = id) => new Request("https://example.com/api/evaluations/translate", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, evaluationId }),
});
test("result translation is owned, access-restricted, cached and never mutates the saved result", async t => {
  const snapshot = structuredClone(original);
  await t.test("foreign results and invalid requests fail before any model call", async () => {
    email = "other@example.com";
    assert.equal((await POST(request("ko"))).status, 404);
    email = null;
    assert.equal((await POST(request("ko"))).status, 401);
    email = "student@example.com";
    assert.equal((await POST(request("id"))).status, 400);
    assert.equal((await POST(request("ko", "invalid"))).status, 400);
    assert.equal(calls, 0);
  });
  await t.test("only authorized feedback is sent to the translator and scores are preserved", async () => {
    const response = await POST(request("ko"));
    assert.equal(response.status, 200);
    const result = (await response.json()).result;
    assert.equal(result.language, "ko");
    assert.ok(result.summary.startsWith("번역"));
    assert.deepEqual(result.overall_range, original.overall_range);
    assert.deepEqual(result.criteria[0].evidence, original.criteria[0].evidence);
    assert.equal(result.criteria[0].detailed_breakdown, undefined);
    assert.equal(result.criteria[0].example_revisions, undefined);
    assert.equal(result.top_improvements.length, 1);
    assert.ok(!lastPrompt.includes("SECRET_"));
    assert.deepEqual(original, snapshot);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  });
  await t.test("cached translations and the original language avoid another model request", async () => {
    assert.equal((await POST(request("ko"))).status, 200);
    assert.equal((await POST(request("en"))).status, 200);
    assert.equal(calls, 1);
  });
  await t.test("failure and pending work leave the original unchanged and release locks", async () => {
    pending = true;
    assert.equal((await POST(request("ms"))).status, 409);
    pending = false; failModel = true;
    assert.equal((await POST(request("ms"))).status, 503);
    assert.ok(![...stored.keys()].some(key => key.endsWith(":lock")));
    assert.deepEqual(original, snapshot);
    failModel = false;
  });
  await t.test("rate limit rejects model calls while cached responses remain available", async () => {
    rate = 30;
    const before = calls;
    assert.equal((await POST(request("ms"))).status, 429);
    assert.equal((await POST(request("ko"))).status, 200);
    assert.equal(calls, before);
  });
  await t.test("guest translation uses only the server's summary preview", async () => {
    email = null; rate = 0;
    const response = await POST(new Request("https://example.com/api/evaluations/translate", { method: "POST", body: JSON.stringify({ language: "ms" }) }));
    assert.equal(response.status, 200);
    const result = (await response.json()).result;
    assert.deepEqual(resultTextFields(result), ["번역 Guest summary"]);
    assert.equal(result.criteria, undefined);
    assert.deepEqual(result.overall_range, guest.overall_range);
  });
});
