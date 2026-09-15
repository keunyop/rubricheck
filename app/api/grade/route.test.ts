import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";

let failure: "rubric" | "evaluation" | "timeout" | "finalization" | null = null;
const rubric = { criteria: [{ name: "Thesis", max_score: 10, description: "Clarity" }] };
const evaluation = {
  summary: "Clear argument", top_improvements: ["Add evidence", "Add detail", "Revise conclusion"],
  criteria_scores: [{ name: "Thesis", score: 8, rationale: "Clear", estimated_range: [7, 9], feedback: "Add detail" }],
};
mock.module("../../../lib/rubricStructuring.ts", { namedExports: {
  hashNormalizedEmail: () => "test-hash",
  structureRubric: async () => { if (failure === "rubric") throw new Error("RUBRIC_STRUCTURE_FAILED"); return rubric; },
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
  globalThis.fetch = async (input, init) => {
    const url = String(input);
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
    for (const [kind, status] of [["rubric", 400], ["evaluation", 500], ["timeout", 504], ["finalization", 500]] as const) {
      await t.test(kind + " failure releases free usage and reports restored remaining", async () => {
        calls.length = 0; failure = kind;
        const response = await POST(request());
        assert.equal(response.status, status);
        assert.equal(response.headers.get("x-ratelimit-remaining"), "3");
        assert.equal(settlements().length, 1);
        assert.equal(settlements()[0].body.p_succeeded, false);
        assert.ok(!calls.some(c => c.name === "rubricheck_reserve_one_credit"));
      });
    }
    await t.test("successful retry confirms once even if result recovery is unavailable", async () => {
      calls.length = 0; failure = null;
      const response = await POST(request());
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-recovery-unavailable"), "1");
      assert.equal(settlements().length, 1);
      assert.equal(settlements()[0].body.p_succeeded, true);
      assert.equal((await response.json()).access_tier, "free");
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
      assert.equal((await POST(request())).status, 200);
      assert.ok(!calls.some(c => c.name === "rubricheck_refund_credit_reservation"));
    });
    await t.test("strict mode rejection reserves nothing", async () => {
      calls.length = 0; credits = 0; reserveStatus = "reserved";
      assert.equal((await POST(request("strict"))).status, 403);
      assert.ok(!calls.some(c => c.name.includes("reserve")));
    });
    await t.test("file parsing failure happens before reservation", async () => {
      calls.length = 0;
      const form = new FormData();
      form.set("rubric", new File(["unparseable"], "rubric.xyz"));
      form.set("assignmentText", "A clear argument.");
      const req = request();
      const response = await POST(new Request(req.url, { method: "POST", headers: { cookie: req.headers.get("cookie")! }, body: form }));
      assert.equal(response.status, 400);
      assert.ok(!calls.some(c => c.name.includes("reserve")));
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
