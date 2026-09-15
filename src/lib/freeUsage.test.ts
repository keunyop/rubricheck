import assert from "node:assert/strict";
import test from "node:test";
import { reserveFreeEvaluateUsage } from "./freeUsage.ts";

test("lost reservation response releases the exact attempt using normalized identity", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://supabase.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    const name = String(url).split("/").pop()!;
    const body = JSON.parse(String(init?.body));
    calls.push({ name, body });
    if (name === "rubricheck_reserve_free_evaluate") throw new Error("response lost");
    return Response.json({ allowed: true, remaining: 3 });
  };
  try {
    await assert.rejects(reserveFreeEvaluateUsage(" USER@Example.com ", 3, "retry"), /response lost/);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].name, "rubricheck_settle_free_evaluate");
    assert.equal(calls[0].body.p_email, "user@example.com");
    assert.equal(calls[1].body.p_email, calls[0].body.p_email);
    assert.equal(calls[1].body.p_reservation_id, calls[0].body.p_reservation_id);
    assert.equal(calls[1].body.p_succeeded, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
