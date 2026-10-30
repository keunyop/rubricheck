import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "./route.ts";
import { GET } from "../../route.ts";
import { CREDIT_SESSION_COOKIE_NAME, createCreditSessionToken } from "../../../../../../src/lib/creditSession.ts";
import type { FeedbackReply, ProductFeedback } from "../../../../../../src/lib/productFeedbackTypes.ts";

test("admin feedback replies validate, send, retain history and recover without duplicate emails", async t => {
  const oldEnv = { ...process.env }, oldFetch = globalThis.fetch;
  Object.assign(process.env, {
    ADMIN_SECRET: "test-admin", ADMIN_EMAILS: "admin@example.com", ENTITLEMENT_SESSION_SECRET: "test-session",
    UPSTASH_REDIS_REST_URL: "https://redis.invalid", UPSTASH_REDIS_REST_TOKEN: "test-only",
    RESEND_API_KEY: "test-only", FEEDBACK_FROM_EMAIL: "RubriCheck Support <support@mail.rubricheck.com>", FEEDBACK_REPLY_TO_EMAIL: "operator@example.com",
  });
  const id = "11111111-1111-4111-8111-111111111111";
  const accountId = "22222222-2222-4222-8222-222222222222";
  const guestId = "33333333-3333-4333-8333-333333333333";
  const items: ProductFeedback[] = [
    { id, category: "issue", message: "My upload failed", page: "/", createdAt: new Date().toISOString(), replyEmail: "reply@example.com", accountEmail: "account@example.com" },
    { id: accountId, category: "issue", message: "Account feedback", page: "/", createdAt: new Date().toISOString(), replyEmail: null, accountEmail: "account@example.com" },
    { id: guestId, category: "issue", message: "Guest feedback", page: "/", createdAt: new Date().toISOString(), replyEmail: null, accountEmail: null },
  ];
  const hashes = new Map<string, Map<string, FeedbackReply>>();
  const locks = new Map<string, string>();
  const accepted = new Map<string, { id: string; body: Record<string, unknown> }>();
  const providerRequests: { key: string; body: Record<string, unknown> }[] = [];
  let mode: "ok" | "reject" | "timeout-after-accept" | "server-error" | "malformed-success" = "ok";
  let redisCalls = 0, failFinish = false, holdProvider: Promise<void> | null = null;
  let providerStarted: (() => void) | undefined;
  function history(feedbackId: string) {
    const key = "rubricheck:{feedback}:replies:" + feedbackId;
    if (!hashes.has(key)) hashes.set(key, new Map());
    return hashes.get(key)!;
  }
  function command(parts: unknown[]): unknown {
    redisCalls++;
    const cmd = String(parts[0]).toLowerCase();
    if (cmd === "lrange") return items.slice(Number(parts[2]), Number(parts[3]) + 1).map(item => JSON.stringify(item));
    if (cmd === "hgetall") return [...(hashes.get(String(parts[1])) ?? [])].flatMap(([key, value]) => [key, JSON.stringify(value)]);
    if (cmd !== "eval") throw Error("Unexpected Redis command " + cmd);
    const [, script, keyCount, hashKey, lockKey, ...args] = parts;
    assert.equal(keyCount, 2);
    assert.match(String(hashKey), /^rubricheck:\{feedback\}:replies:/);
    const hash = hashes.get(String(hashKey)) ?? new Map<string, FeedbackReply>();
    hashes.set(String(hashKey), hash);
    if (String(script).includes("feedback-reply-claim")) {
      const [replyId, candidate, token, cutoff, now] = args.map(String);
      const old = hash.get(replyId);
      const reply: FeedbackReply = old ? structuredClone(old) : JSON.parse(candidate);
      if (reply.status === "sent") return [0, JSON.stringify(reply)];
      const unresolved = [...hash.values()].find(item => item.id !== replyId && (item.status === "pending" || item.status === "unknown"));
      if (unresolved) return [4, JSON.stringify(unresolved)];
      if (old && (reply.status === "pending" || reply.status === "unknown") && reply.attemptedAt <= cutoff) return [3, JSON.stringify(reply)];
      if (locks.has(String(lockKey))) return [2, old ? JSON.stringify(old) : ""];
      locks.set(String(lockKey), token);
      if (reply.status === "failed") reply.attemptedAt = now;
      reply.status = "pending"; hash.set(replyId, structuredClone(reply));
      return [1, JSON.stringify(reply)];
    }
    assert.ok(String(script).includes("feedback-reply-finish"));
    if (failFinish) throw Error("Storage unavailable after delivery");
    const [token, replyId, raw] = args.map(String);
    if (locks.get(String(lockKey)) !== token) return 0;
    hash.set(replyId, JSON.parse(raw)); locks.delete(String(lockKey)); return 1;
  }
  globalThis.fetch = async (url, init) => {
    if (String(url) === "https://api.resend.com/emails") {
      const headers = new Headers(init?.headers), key = headers.get("idempotency-key")!;
      const body = JSON.parse(String(init?.body));
      providerRequests.push({ key, body });
      assert.equal(headers.get("authorization"), "Bearer test-only");
      assert.equal(init?.method, "POST"); assert.ok(init?.signal);
      providerStarted?.();
      if (holdProvider) await holdProvider;
      if (mode === "reject") return Response.json({ message: "PRIVATE PROVIDER ERROR" }, { status: 422 });
      if (mode === "server-error") return Response.json({}, { status: 500 });
      const previous = accepted.get(key);
      if (previous) assert.deepEqual(body, previous.body, "idempotent retry must preserve the entire payload");
      if (!previous) accepted.set(key, { id: "email-" + (accepted.size + 1), body });
      if (mode === "timeout-after-accept") throw new TypeError("Lost response after acceptance");
      if (mode === "malformed-success") return Response.json({ unexpected: true });
      return Response.json({ id: accepted.get(key)!.id });
    }
    assert.ok(String(url).startsWith("https://redis.invalid"), "Tests must not call live services");
    const body = JSON.parse(String(init?.body));
    return Response.json(Array.isArray(body[0]) ? body.map((parts: unknown[]) => ({ result: command(parts) })) : { result: command(body) });
  };
  const valid = { subject: "  Your upload issue is fixed  ", message: "  Thanks for reporting this.\nPlease try again. <script>literal text</script>  " };
  const clean = { subject: valid.subject.trim(), message: valid.message.trim() };
  function send(body: unknown = valid, options: { id?: string; secret?: string | null; email?: string; headers?: Record<string, string> } = {}) {
    const target = options.id ?? id;
    return POST(new Request("https://rubricheck.com/api/admin/feedback/" + target + "/reply", {
      method: "POST", headers: {
        "content-type": "application/json", origin: "https://rubricheck.com",
        ...(options.secret === null ? {} : { "x-admin-secret": options.secret ?? "test-admin" }),
        ...(options.email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: options.email }) } : {}),
        ...options.headers,
      }, body: typeof body === "string" ? body : JSON.stringify(body),
    }), { params: Promise.resolve({ id: target }) });
  }
  function clear() { hashes.clear(); locks.clear(); accepted.clear(); providerRequests.length = 0; mode = "ok"; failFinish = false; }
  try {
    await t.test("rejects unauthorized, cross-site, oversized and invalid requests before storage or email", async () => {
      assert.equal((await send(valid, { secret: null })).status, 401);
      assert.equal((await send(valid, { secret: null, email: "student@example.com" })).status, 401);
      assert.equal((await send(valid, { secret: "wrong" })).status, 401);
      assert.equal((await send(valid, { headers: { origin: "https://evil.example" } })).status, 403);
      assert.equal((await send(valid, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
      assert.equal((await send(valid, { headers: { "content-type": "text/plain" } })).status, 415);
      assert.equal((await send("{")).status, 400);
      assert.equal((await send(valid, { id: "not-a-uuid" })).status, 400);
      assert.equal((await send("x".repeat(64001))).status, 413);
      assert.equal((await send(valid, { headers: { "content-length": "64001" } })).status, 413);
      for (const patch of [{ subject: " " }, { subject: "x".repeat(201) }, { subject: "Subject\r\nBcc: other@example.com" }, { message: " " }, { message: "x".repeat(10001) }, { to: "attacker@example.com" }, { from: "spoofed@example.com" }]) {
        assert.equal((await send({ ...valid, ...patch })).status, 400);
      }
      assert.equal(redisCalls, 0); assert.equal(providerRequests.length, 0);
    });
    await t.test("requires feedback, a recipient and valid mail configuration", async () => {
      assert.equal((await send(valid, { id: "44444444-4444-4444-8444-444444444444" })).status, 404);
      assert.equal((await send(valid, { id: guestId })).status, 422);
      for (const [key, value] of [["FEEDBACK_REPLY_TO_EMAIL", ""], ["FEEDBACK_REPLY_TO_EMAIL", "invalid"], ["FEEDBACK_FROM_EMAIL", "bad\r\nfrom@example.com"], ["RESEND_API_KEY", ""]]) {
        const old = process.env[key]; process.env[key] = value;
        assert.equal((await send()).status, 503); process.env[key] = old;
      }
      assert.equal(providerRequests.length, 0);
    });
    await t.test("uses stored recipient, reply-to, plain text and authenticated admin identity; exposes persisted history", async () => {
      const response = await send(valid, { secret: null, email: "admin@example.com" });
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      const { reply } = await response.json();
      assert.equal(reply.status, "sent"); assert.equal(reply.sentBy, "admin@example.com"); assert.ok(reply.sentAt);
      assert.equal(reply.providerEmailId, "email-1");
      assert.deepEqual(providerRequests[0].body, { from: process.env.FEEDBACK_FROM_EMAIL, to: ["reply@example.com"], reply_to: "operator@example.com", subject: clean.subject, text: clean.message });
      const first = await (await GET(new Request("https://rubricheck.com/api/admin/feedback", { headers: { "x-admin-secret": "test-admin" } }))).json();
      assert.deepEqual(first.items[0].replies, [reply]);
      assert.equal(first.mailSettings.ready, true); assert.equal(first.mailSettings.replyTo, "operator@example.com");
      assert.ok(!JSON.stringify(first).includes("test-only"));
      assert.equal((await send()).status, 200); assert.equal(providerRequests.length, 1, "same content must not resend after reload");
      const account = await send(valid, { id: accountId }); assert.equal(account.status, 200);
      assert.deepEqual(providerRequests[1].body.to, ["account@example.com"]);
    });
    await t.test("concurrent identical sends acquire only one delivery lease", async () => {
      clear();
      let release!: () => void;
      holdProvider = new Promise(resolve => { release = resolve; });
      const started = new Promise<void>(resolve => { providerStarted = resolve; });
      const first = send(); await started;
      assert.equal((await send()).status, 409); assert.equal(providerRequests.length, 1);
      assert.equal((await send({ ...valid, message: "Another reply" })).status, 409);
      release(); assert.equal((await first).status, 200);
      holdProvider = null; providerStarted = undefined;
    });
    await t.test("rejected mail is retained as failed and can be retried", async () => {
      clear(); mode = "reject";
      const rejected = await send(); assert.equal(rejected.status, 502);
      const result = await rejected.json();
      assert.equal(result.code, "FEEDBACK_EMAIL_REJECTED"); assert.equal(result.details.reply.status, "failed");
      assert.ok(!JSON.stringify(result).includes("PRIVATE PROVIDER ERROR"));
      assert.equal([...history(id).values()][0].status, "failed");
      mode = "ok"; assert.equal((await send()).status, 200);
      assert.equal(providerRequests[0].key, providerRequests[1].key); assert.equal(accepted.size, 1);
    });
    await t.test("lost provider response safely retries the frozen payload and blocks a different reply", async () => {
      clear(); mode = "timeout-after-accept";
      const lost = await send(); assert.equal(lost.status, 502);
      assert.equal((await lost.json()).details.reply.status, "unknown"); assert.equal(accepted.size, 1);
      assert.equal((await send({ ...valid, message: "Different message" })).status, 409);
      const oldFrom = process.env.FEEDBACK_FROM_EMAIL;
      process.env.FEEDBACK_FROM_EMAIL = "new-sender@mail.rubricheck.com";
      mode = "ok"; assert.equal((await send()).status, 200);
      process.env.FEEDBACK_FROM_EMAIL = oldFrom;
      assert.equal(accepted.size, 1); assert.equal(providerRequests.length, 2);
      assert.deepEqual(providerRequests[0], providerRequests[1]);
    });
    await t.test("storage failure after acceptance recovers using the same provider key", async () => {
      clear(); failFinish = true;
      assert.equal((await send()).status, 503); assert.equal(accepted.size, 1);
      assert.equal([...history(id).values()][0].status, "pending");
      locks.clear(); failFinish = false;
      assert.equal((await send()).status, 200); assert.equal(accepted.size, 1);
      assert.equal(providerRequests[0].key, providerRequests[1].key);
    });
    await t.test("refuses uncertain retries beyond the provider deduplication window", async () => {
      clear(); mode = "timeout-after-accept";
      await send();
      const reply = [...history(id).values()][0];
      reply.attemptedAt = new Date(Date.now() - 23.5 * 3600000).toISOString(); history(id).set(reply.id, reply);
      mode = "ok";
      const response = await send(); assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "FEEDBACK_REPLY_REVIEW_REQUIRED");
      assert.equal(providerRequests.length, 1);
    });
    await t.test("server errors and malformed success responses are treated as uncertain", async () => {
      for (const providerMode of ["server-error", "malformed-success"] as const) {
        clear(); mode = providerMode;
        const response = await send(); assert.equal(response.status, 502);
        assert.equal((await response.json()).details.reply.status, "unknown");
      }
    });
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
  }
});
