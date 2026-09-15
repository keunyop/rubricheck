import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route.ts";
import { POST as upgrade } from "../upgrade/route.ts";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../../src/lib/creditSession.ts";
import { ownerHash } from "../../../../src/lib/evaluationRecovery.ts";

test("result API requires a valid account and never returns another account's saved task", async () => {
  const oldFetch = globalThis.fetch;
  const oldEnv = { secret: process.env.ENTITLEMENT_SESSION_SECRET, url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  const id = "ae7f951b-1810-4f55-90c2-029899442ff1";
  let calls = 0;
  const record = { owner: ownerHash("owner@example.com"), assignmentText: "private input", rubric: {}, expiresAt: Date.now() + 10000, mode: "standard", result: { evaluation_id: id, title: "Saved result", access_tier: "free", top_improvements: ["Public", "Paid two", "Paid three"], criteria: [{ name: "Evidence", detailed_breakdown: "Paid detail", example_revisions: ["Paid rewrite"] }] } };
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    const result = { result: JSON.stringify(record) };
    return new Response(JSON.stringify(Array.isArray(body[0]) ? [result] : result));
  };
  function request(email?: string) {
    return new Request("https://example.com/api/evaluations/" + id, {
      headers: email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }) } : {},
    });
  }
  try {
    const params = { params: Promise.resolve({ id }) };
    assert.equal((await GET(request(), params)).status, 401);
    assert.equal((await upgrade(new Request("https://example.com/api/evaluations/upgrade", { method: "POST", body: "{}" }))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await GET(request("other@example.com"), params)).status, 404);
    const response = await GET(request("owner@example.com"), params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.result.evaluation_id, id);
    assert.deepEqual(data.result.top_improvements, ["Public"]);
    assert.equal(data.result.criteria[0].detailed_breakdown, undefined);
    assert.equal(data.result.criteria[0].example_revisions, undefined);
    assert.equal(data.assignmentText, undefined);
    assert.equal(data.owner, undefined);
    record.expiresAt = Date.now() - 1;
    assert.equal((await GET(request("owner@example.com"), params)).status, 404);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries({ ENTITLEMENT_SESSION_SECRET: oldEnv.secret, UPSTASH_REDIS_REST_URL: oldEnv.url, UPSTASH_REDIS_REST_TOKEN: oldEnv.token })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
