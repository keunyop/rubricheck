import assert from "node:assert/strict";
import test from "node:test";
import { saveEvaluation, getEvaluation, upgradeEvaluation, normalizeEvaluationId } from "./evaluationRecovery.ts";
import { createEvaluationCheckout, evaluationCheckoutFields, validateCheckoutEvaluation } from "./evaluationCheckout.ts";
import { mergeDetailedEvaluation } from "./mergeDetailedEvaluation.ts";
import type Stripe from "stripe";
import type { FinalEvaluation } from "../../lib/gradeFinalization";

const original: FinalEvaluation = {
  title: "Original", access_tier: "free", overall_range: [60, 70], summary: "Original summary",
  top_improvements: ["One", "Two", "Three"],
  criteria: [{ name: "Evidence", max_score: 100, score: 65, rationale: "Reason", feedback: "Feedback", estimated_range: [60, 70], detailed_breakdown_locked: true }],
};
const detailed: FinalEvaluation = { ...original, access_tier: "topup", overall_range: [70, 80], criteria: [{ ...original.criteria[0], score: 75, detailed_breakdown: "Use evidence from paragraph 2.", example_revisions: ["Add a citation."] }] };

test("recovery binds ownership, rejects expired IDs, serializes upgrades and reuses checkout", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const values = new Map<string, string>();
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  function command(parts: unknown[]): unknown {
    const [rawOp, key, ...args] = parts;
    const op = String(rawOp).toLowerCase();
    if (op === "get") return values.get(String(key)) ?? null;
    if (op === "set") {
      if (args.includes("nx") && values.has(String(key))) return null;
      values.set(String(key), String(args[0]));
      return "OK";
    }
    if (op === "eval") {
      const numKeys = Number(args[0]);
      const keys = args.slice(1, numKeys + 1).map(String);
      const argv = args.slice(numKeys + 1);
      if (String(key).includes("record.expiresAt")) {
        const raw = values.get(keys[0]); if (!raw) return 0;
        const record = JSON.parse(raw); record.expiresAt = Number(argv[0]); values.set(keys[0], JSON.stringify(record)); return 1;
      }
      if (values.get(keys[0]) !== String(argv[0])) return 0;
      if (numKeys === 2) values.set(keys[1], String(argv[1]));
      else values.delete(keys[0]);
      return 1;
    }
    throw new Error("Unexpected Redis command: " + op);
  }
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const result = Array.isArray(body[0]) ? body.map((parts: unknown[]) => ({ result: command(parts) })) : { result: command(body) };
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const saved = await saveEvaluation({ email: "student@example.com", rubric: { criteria: [{ name: "Evidence", max_score: 100, description: "Citations" }] }, assignmentText: "Original assignment", mode: "standard", result: original });
    assert.ok(normalizeEvaluationId(saved.evaluation_id));
    assert.equal(await getEvaluation(saved.evaluation_id, "other@example.com"), null);
    assert.equal(await getEvaluation("../other", "student@example.com"), null);
    await assert.rejects(validateCheckoutEvaluation(saved.evaluation_id, "other@example.com"), /EVALUATION_EXPIRED/);
    assert.equal(await validateCheckoutEvaluation(saved.evaluation_id, "student@example.com"), saved.evaluation_id);
    assert.ok((await getEvaluation(saved.evaluation_id, "student@example.com"))!.expiresAt > Date.now() + 6 * 86400000);
    const retryable = await saveEvaluation({ email: "student@example.com", rubric: { criteria: [] }, assignmentText: "Retry assignment", mode: "standard", result: original });
    await assert.rejects(upgradeEvaluation(retryable.evaluation_id, "student@example.com", async () => { throw Error("model failed"); }), /model failed/);
    const retried = await upgradeEvaluation(retryable.evaluation_id, "student@example.com", async record => mergeDetailedEvaluation(record.result, detailed));
    assert.equal(retried.access_tier, "topup");
    let unblock!: () => void;
    const gate = new Promise<void>((resolve) => { unblock = resolve; });
    let started!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    let generated = 0;
    const pending = upgradeEvaluation(saved.evaluation_id, "student@example.com", async (record) => {
      generated++; started(); await gate;
      assert.equal(record.assignmentText, "Original assignment");
      return mergeDetailedEvaluation(record.result, detailed);
    });
    await entered;
    await assert.rejects(upgradeEvaluation(saved.evaluation_id, "student@example.com", async () => { throw Error("must not run"); }), /UPGRADE_PENDING/);
    unblock();
    const upgraded = await pending;
    assert.equal(upgraded.evaluation_id, saved.evaluation_id);
    assert.equal(upgraded.access_tier, "topup");
    assert.equal(upgraded.criteria[0].score, 65);
    assert.deepEqual(upgraded.overall_range, [60, 70]);
    assert.equal(upgraded.criteria[0].detailed_breakdown_locked, false);
    assert.deepEqual(await upgradeEvaluation(saved.evaluation_id, "student@example.com", async () => { throw Error("must not regenerate"); }), upgraded);
    assert.equal(generated, 1);

    let creates = 0;
    let status = "open";
    const sessions = new Map<string, object>();
    const stripe = { checkout: { sessions: {
      create: async (_params: unknown, options: { idempotencyKey: string }) => {
        if (!sessions.has(options.idempotencyKey)) sessions.set(options.idempotencyKey, { id: "cs_test_" + ++creates, status: "open", url: "https://checkout.stripe.com/test" });
        return sessions.get(options.idempotencyKey);
      },
      retrieve: async (id: string) => ({ id, status, url: status === "open" ? "https://checkout.stripe.com/test" : null }),
    } } } as unknown as Stripe;
    const params = { mode: "payment" as const, ...evaluationCheckoutFields("https://example.com", saved.evaluation_id) };
    const [first, concurrent] = await Promise.all([createEvaluationCheckout(stripe, params, "student@example.com", saved.evaluation_id), createEvaluationCheckout(stripe, params, "student@example.com", saved.evaluation_id)]);
    assert.equal(first.id, concurrent.id);
    assert.equal(creates, 1);
    status = "complete";
    const completed = await createEvaluationCheckout(stripe, params, "student@example.com", saved.evaluation_id);
    assert.equal(completed.status, "complete");
    assert.equal(creates, 1);
    status = "expired";
    await createEvaluationCheckout(stripe, params, "student@example.com", saved.evaluation_id);
    assert.equal(creates, 2);

    const key = "rubricheck:evaluation:" + saved.evaluation_id;
    const record = JSON.parse(values.get(key)!);
    values.set(key, JSON.stringify({ ...record, expiresAt: Date.now() - 1 }));
    assert.equal(await getEvaluation(saved.evaluation_id, "student@example.com"), null);
    await assert.rejects(upgradeEvaluation(saved.evaluation_id, "student@example.com", async () => upgraded), /EVALUATION_EXPIRED/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});

test("incomplete or mismatched model detail cannot unlock a result", () => {
  assert.throws(() => mergeDetailedEvaluation(original, original), /DETAILED_EVALUATION_INVALID/);
  assert.throws(() => mergeDetailedEvaluation(original, { ...detailed, criteria: [] }), /DETAILED_EVALUATION_INVALID/);
  assert.throws(() => mergeDetailedEvaluation(original, { ...detailed, criteria: [{ ...detailed.criteria[0], detailed_breakdown: "" }] }), /DETAILED_EVALUATION_INVALID/);
  assert.throws(() => mergeDetailedEvaluation(original, { ...detailed, criteria: [{ ...detailed.criteria[0], name: "Wrong" }] }), /DETAILED_EVALUATION_INVALID/);
});

test("checkout return and cancel URLs include only the original opaque ID", () => {
  const id = "ae7f951b-1810-4f55-90c2-029899442ff1";
  const fields = evaluationCheckoutFields("https://example.com/", id);
  assert.equal(fields.success_url, "https://example.com/?checkout_session_id={CHECKOUT_SESSION_ID}&evaluation_id=" + id);
  assert.equal(fields.cancel_url, "https://example.com/?evaluation_id=" + id + "&checkout_canceled=1");
  assert.equal(evaluationCheckoutFields("https://example.com", null).cancel_url, "https://example.com/billing/cancel");
});
