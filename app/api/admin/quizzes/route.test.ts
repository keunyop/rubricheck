import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../../src/lib/creditSession.ts";

let calls = 0, unavailable = false;
const report = { coverage: "complete", totals: { quizzes: 3 }, generation: { completed: 4 } };
mock.module("../../../../src/lib/adminQuizMetrics.ts", { namedExports: {
  getAdminQuizMetrics: async () => { calls++; if (unavailable) throw new Error("private redis connection secret"); return report; },
} });
const { GET } = await import("./route.ts");

test("quiz metrics require admin authorization, never cache, and do not disguise storage failure as zero", async () => {
  const previousEnv = { ...process.env };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.ADMIN_SECRET = "admin-test";
  process.env.ADMIN_EMAILS = "admin@example.com";
  const request = (headers: Record<string, string> = {}) => new Request("https://example.com/api/admin/quizzes", { headers });
  try {
    const unauthorized: Array<Record<string, string>> = [{}, { "x-admin-secret": "wrong" }, { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: "student@example.com" }) }];
    for (const headers of unauthorized) {
      const response = await GET(request(headers));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
    assert.equal(calls, 0);
    const response = await GET(request({ cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: "admin@example.com" }) }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), report);
    assert.equal(calls, 1);
    unavailable = true;
    const failed = await GET(request({ "x-admin-secret": "admin-test" }));
    assert.equal(failed.status, 503);
    const body = await failed.text();
    assert.ok(!body.includes("private redis"));
    assert.ok(!body.includes("totals"));
  } finally { process.env = previousEnv; }
});
