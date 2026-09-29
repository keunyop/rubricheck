import assert from "node:assert/strict";
import test from "node:test";
import { getAdminDashboardData } from "./adminDashboard.ts";
import { GET } from "../../app/api/admin/dashboard/route.ts";

test("dashboard pagination uses one bounded RPC, preserves global summary, and validates inputs", async (t) => {
  const savedEnv = { ...process.env };
  process.env.SUPABASE_URL = "https://test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.ADMIN_SECRET = "test-admin";
  t.after(() => { process.env = savedEnv; });
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const result = {
    generatedAt: "2026-01-01T00:00:00Z",
    summary: { knownUsers: 200, proUsers: 10, topUpUsers: 10, freeUsers: 180, remainingCredits: 50 },
    subscribers: [],
    pagination: { page: 2, pageSize: 25, total: 200, totalPages: 8 },
  };
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    calls.push({ url: input, body: JSON.parse(String(init.body)) });
    return Response.json(result);
  });

  const unauthorized = await GET(new Request("http://localhost/api/admin/dashboard?page=2"));
  assert.equal(unauthorized.status, 401);
  assert.equal(calls.length, 0);

  const response = await GET(new Request("http://localhost/api/admin/dashboard?page=2&pageSize=25&q=%20PRO%20", {
    headers: { "x-admin-secret": "test-admin" },
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.summary, result.summary);
  assert.deepEqual(body.pagination, result.pagination);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://test.invalid/rest/v1/rpc/rubricheck_admin_dashboard");
  assert.deepEqual(calls[0].body, { p_page: 2, p_page_size: 25, p_query: "pro", p_free_trial_limit: 3 });

  for (const invalid of ["-1", "0", "1.5", "nope", "Infinity", "99999999999999999999"]) {
    await getAdminDashboardData(new URLSearchParams({ page: invalid, pageSize: invalid }));
    assert.equal(calls.at(-1)?.body.p_page, 1);
    assert.equal(calls.at(-1)?.body.p_page_size, 25);
  }
  await getAdminDashboardData(new URLSearchParams({ page: "9999999999", pageSize: "100000", q: "X".repeat(250) }));
  assert.equal(calls.at(-1)?.body.p_page, 2147483647);
  assert.equal(calls.at(-1)?.body.p_page_size, 100);
  assert.equal(calls.at(-1)?.body.p_query, "x".repeat(200));

  delete process.env.SUPABASE_URL;
  const callCount = calls.length;
  const empty = await getAdminDashboardData(new URLSearchParams("page=3&pageSize=50"));
  assert.equal(calls.length, callCount);
  assert.deepEqual(empty.subscribers, []);
  assert.deepEqual(empty.pagination, { page: 1, pageSize: 50, total: 0, totalPages: 1 });
});
