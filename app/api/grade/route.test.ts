import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";
import { gradingFailureCode } from "../../../src/lib/gradingFailureCapture.ts";
import type { GradingFailureInput } from "../../../src/lib/gradingFailures.ts";

const capturedFailures: GradingFailureInput[] = [];
mock.module("../../../src/lib/gradingFailureCapture.ts", { namedExports: {
  gradingFailureCode,
  queueGradingFailure: (input: GradingFailureInput) => { capturedFailures.push(input); },
} });

let failure: "rubric" | "rubricProvider" | "rubricTimeout" | "evaluation" | "timeout" | "finalization" | null = null;
const rubric = { criteria: [{ name: "Thesis", max_score: 10, description: "Clarity" }] };
const evaluation = {
  summary: "Clear argument", top_improvements: ["Add evidence", "Add detail", "Revise conclusion"],
  criteria_scores: [{ name: "Thesis", score: 8, rationale: "Clear", estimated_range: [7, 9], feedback: "Add detail" }],
};
// Keep the real rubric parser/schema in the route test: a model response with one
// valid criterion previously failed here even though the mocked route passed.
mock.module("../../../lib/openai.ts", { namedExports: {
  callStructureModel: async () => {
    if (failure === "rubricProvider") throw new Error("upstream unavailable");
    if (failure === "rubricTimeout") throw new Error("OPENAI_TIMEOUT");
    return failure === "rubric" ? { criteria: [] } : rubric;
  },
  callEvaluationModel: async () => evaluation,
} });
mock.module("../../../lib/evaluation.ts", { namedExports: {
  evaluateAssignment: async () => {
    if (failure === "timeout") throw new Error("OPENAI_TIMEOUT");
    if (failure === "evaluation") throw new Error("EVALUATION_FAILED");
    return failure === "finalization" ? { ...evaluation, criteria_scores: [] } : evaluation;
  },
} });
const { POST } = await import("./route.ts");

test("grade reservations cover failure, retry, paid credits, strict access and successful recovery outages", async (t) => {
  const previousEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.SUPABASE_URL = "https://supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  let reserveStatus = "reserved";
  let confirmationFailures = 0;
  let releaseFails = false;
  let credits = 0;
  let pro = false;
  let visionResponse: unknown = { responses: [] };
  let visionStatus = 200;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://vision.googleapis.com/")) return Response.json(visionResponse, { status: visionStatus });
    const name = url.split("/").pop()!;
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ name, body });
    let result: unknown;
    if (name === "rubricheck_get_account_entitlement_by_email") result = pro ? { customer_id: "cus_test", email: "user@example.com", plan: "pro", status: "active", current_period_end: 9999999999 } : null;
    else if (name === "rubricheck_credit_balance") result = credits;
    else if (name === "rubricheck_reserve_free_evaluate") result = { status: reserveStatus, count: 1, remaining: 2 };
    else if (name === "rubricheck_settle_free_evaluate") {
      if ((body.p_succeeded && confirmationFailures-- > 0) || (!body.p_succeeded && releaseFails)) throw new Error("store unavailable");
      result = { allowed: true, remaining: body.p_succeeded ? 2 : 3 };
    } else if (name === "rubricheck_reserve_one_credit") result = { reserved: true, balance_after: credits - 1, usage_event_id: "credit-event", lot_id: 1 };
    else if (name === "rubricheck_refund_credit_reservation") result = credits;
    else throw new Error("Unexpected fetch: " + url);
    return Response.json(result);
  };
  function request(mode = "standard", key = "retry-key") {
    return new Request("https://example.com/api/grade", { method: "POST", headers: {
      "content-type": "application/json", "idempotency-key": key,
      cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: "user@example.com" }),
    }, body: JSON.stringify({ mode, rubricText: "Thesis 10 points", assignmentText: "A clear argument with support." }) });
  }
  const settlements = () => calls.filter(c => c.name === "rubricheck_settle_free_evaluate");
  try {
    for (const [kind, status, code] of [
      ["rubric", 400, "RUBRIC_STRUCTURE_FAILED"],
      ["rubricProvider", 503, "RUBRIC_MODEL_UNAVAILABLE"],
      ["rubricTimeout", 504, "OPENAI_TIMEOUT"],
      ["evaluation", 500, "EVALUATION_FAILED"],
      ["timeout", 504, "OPENAI_TIMEOUT"],
      ["finalization", 500, "EVALUATION_FAILED"],
    ] as const) {
      await t.test(kind + " failure releases free usage and reports restored remaining", async () => {
        calls.length = 0; capturedFailures.length = 0; failure = kind;
        const response = await POST(request());
        assert.equal(response.status, status);
        assert.equal((await response.json()).code, code);
        assert.equal(response.headers.get("x-ratelimit-remaining"), "3");
        assert.equal(settlements().length, 1);
        assert.equal(settlements()[0].body.p_succeeded, false);
        assert.ok(!calls.some(c => c.name === "rubricheck_reserve_one_credit"));
        assert.equal(capturedFailures.length, 1);
        assert.equal(capturedFailures[0].code, code);
        assert.equal(capturedFailures[0].inputs.rubricText, "Thesis 10 points");
        assert.equal(capturedFailures[0].inputs.assignmentText, "A clear argument with support.");
      });
    }
    await t.test("a single-criterion rubric grades successfully and confirms once on retry", async () => {
      calls.length = 0; capturedFailures.length = 0; failure = null;
      const response = await POST(request());
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-recovery-unavailable"), "1");
      assert.equal(settlements().length, 1);
      assert.equal(settlements()[0].body.p_succeeded, true);
      const payload = await response.json();
      assert.equal(payload.access_tier, "free");
      assert.deepEqual(payload.top_improvements, ["Add evidence"]);
      assert.deepEqual(payload.overall_range, [70, 90]);
      assert.equal(payload.criteria.length, 1);
      assert.equal(capturedFailures.length, 0);
      assert.equal(payload.score_calculation.mode_adjustment, 0);
    });
    await t.test("confirmation response loss retries the same reservation and preserves result", async () => {
      calls.length = 0; confirmationFailures = 1;
      assert.equal((await POST(request())).status, 200);
      assert.equal(settlements().length, 2);
      assert.deepEqual(settlements()[0].body, settlements()[1].body);
    });
    await t.test("confirmation outage cannot turn a valid evaluation into a failure", async () => {
      calls.length = 0; confirmationFailures = 2;
      assert.equal((await POST(request())).status, 200);
      assert.ok(settlements().every(c => c.body.p_succeeded === true));
    });
    await t.test("pending or completed duplicate never consumes purchased credits", async () => {
      credits = 5;
      for (reserveStatus of ["pending", "succeeded"]) {
        calls.length = 0;
        assert.equal((await POST(request())).status, 409);
        assert.equal(settlements().length, 0);
        assert.ok(!calls.some(c => c.name === "rubricheck_reserve_one_credit"));
      }
    });
    await t.test("purchased credit failures still refund and restore the balance header", async () => {
      calls.length = 0; reserveStatus = "exhausted"; failure = "evaluation";
      const response = await POST(request());
      assert.equal(response.status, 500);
      assert.equal(response.headers.get("x-credits-balance"), "5");
      assert.equal(calls.filter(c => c.name === "rubricheck_refund_credit_reservation").length, 1);
      assert.equal(settlements().length, 0);
    });
    await t.test("purchased credit success is not refunded", async () => {
      calls.length = 0; failure = null;
      const response = await POST(request());
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.access_tier, "topup");
      assert.deepEqual(payload.top_improvements, evaluation.top_improvements);
      assert.ok(!calls.some(c => c.name === "rubricheck_refund_credit_reservation"));
    });
    await t.test("strict mode rejection reserves nothing", async () => {
      calls.length = 0; credits = 0; reserveStatus = "reserved";
      assert.equal((await POST(request("strict"))).status, 403);
      assert.ok(!calls.some(c => c.name.includes("reserve")));
    });
    await t.test("file parsing failure happens before reservation", async () => {
      calls.length = 0; capturedFailures.length = 0;
      const form = new FormData();
      form.set("rubric", new File(["unparseable"], "rubric.xyz"));
      form.set("assignmentText", "A clear argument.");
      const req = request();
      const response = await POST(new Request(req.url, { method: "POST", headers: { cookie: req.headers.get("cookie")! }, body: form }));
      assert.equal(response.status, 400);
      assert.ok(!calls.some(c => c.name.includes("reserve")));
      assert.equal(capturedFailures.length, 1);
      assert.equal(capturedFailures[0].stage, "file_parsing");
      assert.equal(capturedFailures[0].files[0].file.name, "rubric.xyz");
      assert.equal(await capturedFailures[0].files[0].file.text(), "unparseable");
    });
    await t.test("OCR failures do not charge, retain originals, and retry successfully with one or multiple images", async () => {
      process.env.GOOGLE_CLOUD_VISION_API_KEY = "test-only";
      failure = null; reserveStatus = "reserved"; credits = 5;
      const imageRequest = (count = 1) => {
        const form = new FormData();
        form.set("rubricText", "Thesis 10 points");
        for (let i = 0; i < count; i++) form.append("assignment", new File(["synthetic image " + i], `page-${i}.png`, { type: "image/png" }));
        const req = request();
        return new Request(req.url, { method: "POST", headers: { cookie: req.headers.get("cookie")!, "idempotency-key": "image-retry" }, body: form });
      };
      for (const [status, body, expectedCode] of [
        [400, { error: { details: [{ reason: "API_KEY_INVALID" }] } }, "OCR_UNAVAILABLE"],
        [200, { responses: [{ error: { code: 3 } }] }, "FILE_PARSE_FAILED"],
        [200, { responses: [{ error: { code: 8 } }] }, "OCR_UNAVAILABLE"],
      ] as const) {
        calls.length = 0; capturedFailures.length = 0; visionStatus = status; visionResponse = body;
        const response = await POST(imageRequest());
        assert.equal(response.status, expectedCode === "OCR_UNAVAILABLE" ? 503 : 400);
        const payload = await response.json();
        assert.equal(payload.code, expectedCode);
        assert.equal(payload.details.field, "assignment");
        assert.ok(!calls.some(c => /reserve|settle|refund/.test(c.name)));
        assert.equal(capturedFailures.length, 1);
        assert.equal(capturedFailures[0].stage, "file_parsing");
        assert.equal(capturedFailures[0].code, expectedCode);
        assert.equal(await capturedFailures[0].files[0].file.text(), "synthetic image 0");
      }
      visionStatus = 200;
      for (const count of [1, 2]) {
        calls.length = 0; capturedFailures.length = 0;
        visionResponse = { responses: [{ fullTextAnnotation: { text: count === 1 ? "A well supported synthetic assignment. ".repeat(10) : "One short image page." } }] };
        const response = await POST(imageRequest(count));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).criteria.length, 1);
        assert.equal(settlements().length, 1);
        assert.equal(settlements()[0].body.p_succeeded, true);
        assert.equal(capturedFailures.length, 0);
      }
      credits = 0;
    });
    await t.test("diagnostics preserve exact text and exclude validation and quota rejections", async () => {
      capturedFailures.length = 0; failure = "rubric";
      const original = request();
      const text = "  An original draft.\r\n\n";
      await POST(new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify({ rubricText: "Thesis 10 points", assignmentText: text }) }));
      assert.equal(capturedFailures[0].inputs.assignmentText, text);
      capturedFailures.length = 0;
      await POST(new Request(original.url, { method: "POST", headers: original.headers, body: "{}" }));
      reserveStatus = "exhausted"; credits = 0;
      await POST(request());
      assert.equal(capturedFailures.length, 0);
      reserveStatus = "reserved";
    });
    await t.test("failed release preserves the original model error", async () => {
      calls.length = 0; releaseFails = true; failure = "timeout";
      const response = await POST(request());
      assert.equal(response.status, 504);
      assert.equal((await response.json()).code, "OPENAI_TIMEOUT");
      releaseFails = false;
    });
    await t.test("Pro success and failure never reserve free usage or credits", async () => {
      pro = true;
      for (failure of [null, "evaluation"] as const) {
        calls.length = 0;
        assert.equal((await POST(request())).status, failure ? 500 : 200);
        assert.ok(!calls.some(c => c.name.includes("reserve") || c.name.includes("settle")));
      }
      pro = false;
    });
    await t.test("same request key is stable across retries and changes with inputs", async () => {
      calls.length = 0; reserveStatus = "reserved"; failure = "evaluation";
      await POST(request()); await POST(request());
      const reservations = calls.filter(c => c.name === "rubricheck_reserve_free_evaluate");
      assert.equal(reservations[0].body.p_request_key, reservations[1].body.p_request_key);
      assert.notEqual(reservations[0].body.p_reservation_id, reservations[1].body.p_reservation_id);
      await POST(request("standard", "new-attempt"));
      assert.notEqual(reservations[0].body.p_request_key, calls.filter(c => c.name === "rubricheck_reserve_free_evaluate")[2].body.p_request_key);
    });
    await t.test("real exhaustion keeps the existing upgrade response", async () => {
      calls.length = 0; reserveStatus = "exhausted";
      const response = await POST(request());
      assert.equal(response.status, 429);
      assert.equal((await response.json()).code, "FREE_LIMIT_REACHED");
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});
