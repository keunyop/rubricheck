import assert from "node:assert/strict";
import { test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";
import { POST } from "./route.ts";
import { GET } from "../admin/feedback/route.ts";
import type { ProductFeedback } from "../../../src/lib/productFeedbackTypes.ts";

test("feedback validates input, binds verified accounts, limits submissions and restricts paginated reads to admins", async () => {
  const oldEnv = { ...process.env };
  const oldFetch = globalThis.fetch;
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.ADMIN_SECRET = "test-admin";
  process.env.ADMIN_EMAILS = "admin@example.com";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  const inbox: ProductFeedback[] = [];
  const counts = new Map<string, number>();
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    function command(parts: unknown[]) {
      calls++;
      if (String(parts[0]).toLowerCase() === "eval") {
        const [, , keyCount, inboxKey, limitKey, raw, limit, ttl] = parts;
        assert.equal(keyCount, 2);
        assert.equal(inboxKey, "rubricheck:{feedback}:inbox");
        assert.equal(ttl, 3600);
        assert.match(String(limitKey), /^rubricheck:\{feedback\}:limit:[a-f0-9]{64}$/);
        const count = counts.get(String(limitKey)) ?? 0;
        if (count >= Number(limit)) return 0;
        counts.set(String(limitKey), count + 1);
        inbox.unshift(JSON.parse(String(raw)));
        return 1;
      }
      if (String(parts[0]).toLowerCase() === "lrange") return inbox.slice(Number(parts[2]), Number(parts[3]) + 1).map(item => JSON.stringify(item));
      throw new Error("Unexpected Redis command");
    }
    return Response.json(Array.isArray(body[0]) ? body.map((parts: unknown[]) => ({ result: command(parts) })) : { result: command(body) });
  };
  const valid = { category: "idea", message: "  Better navigation please.  ", replyEmail: "reply@example.com", page: "/" };
  function submit(body: unknown = valid, email?: string, headers: Record<string, string> = {}) {
    return POST(new Request("https://example.com/api/feedback", {
      method: "POST", headers: { "content-type": "application/json", origin: "https://example.com", "x-forwarded-for": "192.0.2.1", ...(email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }) } : {}), ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }));
  }
  function read(query = "", email?: string, secret?: string) {
    return GET(new Request("https://example.com/api/admin/feedback" + query, {
      headers: { ...(email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }) } : {}), ...(secret ? { "x-admin-secret": secret } : {}) },
    }));
  }
  try {
    assert.equal((await read()).status, 401);
    assert.equal((await read("", "student@example.com")).status, 401);
    assert.equal((await read("", undefined, "wrong")).status, 401);
    assert.equal((await submit(valid, undefined, { origin: "https://evil.example" })).status, 403);
    assert.equal((await submit(valid, undefined, { "content-type": "text/plain" })).status, 415);
    assert.equal((await submit("{")).status, 400);
    for (const patch of [{ message: " " }, { message: "x".repeat(5001) }, { replyEmail: "invalid" }, { category: "unknown" }, { page: "//evil.example" }, { page: "/?secret=hidden" }]) {
      assert.equal((await submit({ ...valid, ...patch })).status, 400);
    }
    assert.equal((await submit("x".repeat(24001))).status, 413);
    const proxied = await POST(new Request("http://internal:3000/api/feedback", { method: "POST", headers: { origin: "https://example.com", "x-forwarded-host": "example.com", "x-forwarded-proto": "https", "content-type": "application/json" }, body: JSON.stringify({ category: "idea", message: " " }) }));
    assert.equal(proxied.status, 400);
    assert.equal(calls, 0);
    const saved = await submit({ ...valid, accountEmail: "admin@example.com", createdAt: "spoofed", id: "spoofed" }, "student@example.com");
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { ok: true });
    assert.equal(inbox[0].accountEmail, "student@example.com");
    assert.equal(inbox[0].replyEmail, "reply@example.com");
    assert.equal(inbox[0].message, "Better navigation please.");
    assert.notEqual(inbox[0].id, "spoofed");
    assert.notEqual(inbox[0].createdAt, "spoofed");
    assert.equal((await submit({ category: "issue", message: "Guest message" })).status, 200);
    assert.equal(inbox[0].accountEmail, null);
    assert.equal(inbox[0].replyEmail, null);
    for (let i = 1; i < 5; i++) assert.equal((await submit(valid, "student@example.com")).status, 200);
    const limited = await submit(valid, "student@example.com");
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "3600");
    assert.equal(inbox.length, 6);
    for (const query of ["?offset=-1", "?offset=no", "?offset=0.5", "?offset=9007199254740992"]) assert.equal((await read(query, "admin@example.com")).status, 400);
    for (let i = 0; i < 24; i++) await submit({ ...valid, message: "Message " + i }, "user" + i + "@example.com");
    const page = await read("", "admin@example.com");
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("cache-control"), "no-store");
    const first = await page.json();
    assert.equal(first.items.length, 25);
    assert.equal(first.items[0].message, "Message 23");
    assert.equal(first.nextOffset, 25);
    const second = await (await read("?offset=25", undefined, "test-admin")).json();
    assert.equal(second.items.length, 5);
    assert.equal(second.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 30);
    delete process.env.UPSTASH_REDIS_REST_URL;
    assert.equal((await submit(valid)).status, 503);
    assert.equal((await read("", "admin@example.com")).status, 503);
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});
