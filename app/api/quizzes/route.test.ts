import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";
import type { QuizSource } from "../../../src/lib/quizTypes.ts";

const values = new Map<string, unknown>();
const reads: string[] = [];
let parsedFiles = 0;
const ownerHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const redis = {
  get: async (key: string) => { reads.push(key); return values.get(key) ?? null; },
  hget: async (key: string, field: string) => { reads.push(key); return values.get(key + ":" + field) ?? null; },
  hgetall: async (key: string) => { reads.push(key); return {}; },
  eval: async (_script: string, keys: string[], args: unknown[]) => { reads.push(keys[0]); assert.equal(args[0], "sweep"); return true; },
  set: async (key: string, value: unknown) => { values.set(key, value); return "OK"; },
};
mock.module("../../../src/lib/evaluationRecovery.ts", { namedExports: {
  ownerHash, recoveryRedis: () => redis,
  getEvaluation: async (id: string, email: string) => { reads.push("original:" + email + ":" + id); return null; },
} });
mock.module("../../../src/lib/assignmentWorkspace.ts", { namedExports: {
  workspaceKey: (email: string) => "workspace:" + ownerHash(email),
  getProject: async () => null,
  listWorkspace: async () => ({ projects: [], assignments: [] }),
} });
mock.module("../../../lib/quizParse.ts", { namedExports: {
  paragraphSegments: (text: string) => [{ unit: 1, text }],
  parseQuizFile: async () => { parsedFiles++; throw new Error("Should not parse"); },
} });
mock.module("../../../src/lib/accountEntitlements.ts", { namedExports: {
  getAccountEntitlementByEmail: async () => null, isActiveProAccountEntitlement: () => false,
} });
const { GET, POST, PATCH } = await import("./route.ts");
const sources = await import("./sources/route.ts");
const attempts = await import("./attempts/route.ts");
const { quizKey, quizSourceKey } = await import("../../../src/lib/quizStore.ts");
const id = randomUUID(), sourceId = randomUUID();
const owner = "quiz-owner@test.invalid", other = "quiz-other@test.invalid";
process.env.ENTITLEMENT_SESSION_SECRET = "unit-quiz-only";

function request(path: string, email?: string, body?: unknown, method = body ? "POST" : "GET", origin?: string) {
  return new Request("https://example.com/api/quizzes" + path, { method, headers: {
    ...(email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }) } : {}),
    ...(origin ? { origin } : {}), "Content-Type": "application/json",
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const settings = { title: "Geometry", projectId: null, count: 2, language: "en", difficulty: "standard", purpose: "concepts", topic: "" };
const payload = { requestId: id, settings, sources: [{ id: sourceId, units: [1] }] };

test("every quiz API authenticates before reading bodies, storage or parsing files", async () => {
  const before = reads.length;
  for (const [handler, req] of [
    [GET, request("")], [POST, request("", undefined, payload)], [PATCH, request("", undefined, { action: "delete", quizId: id }, "PATCH")],
    [sources.GET, request("/sources?id=" + sourceId)], [sources.POST, request("/sources", undefined, { action: "text", name: "Secret", text: "a".repeat(30) })],
    [sources.PUT, request("/sources?id=" + sourceId + "&index=0", undefined, {}, "PUT")],
    [attempts.POST, request("/attempts", undefined, { action: "start", id: randomUUID(), quizId: id, kind: "full" })],
  ] as const) {
    const response = await handler(req);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(response.headers.get("X-Robots-Tag")!, /noindex/);
  }
  assert.equal(reads.length, before);
  assert.equal(parsedFiles, 0);
  assert.equal((await POST(request("", owner, payload, "POST", "https://untrusted.example"))).status, 403);
});

test("quiz and original-source lookups always use the authenticated owner", async () => {
  const source: QuizSource = { id: sourceId, name: "Private notes", kind: "text", unitKind: "paragraph", totalUnits: 1, segments: [{ unit: 1, text: "A triangle has three sides." }], bytes: 0, receivedAt: Date.now(), expiresAt: Date.now() + 60_000, assignmentId: null, version: null, projectId: null };
  values.set(quizSourceKey(owner, sourceId), source);
  assert.equal((await sources.GET(request("/sources?id=" + sourceId, owner))).status, 200);
  assert.equal((await sources.GET(request("/sources?id=" + sourceId, other))).status, 410);
  assert.equal((await GET(request("?id=" + id, other))).status, 404);
  assert.equal((await POST(request("", other, payload))).status, 410);
  assert.ok(reads.includes(quizSourceKey(other, sourceId)));
  source.assignmentId = id;
  assert.equal((await sources.GET(request("/sources?id=" + sourceId, owner))).status, 410, "expired original cannot be replaced by a retained copy");
  assert.equal((await sources.POST(request("/sources", owner, { action: "assignment", id }))).status, 410);
});

test("completed request replay works after source expiry and rejects a changed payload", async () => {
  const fingerprint = createHash("sha256").update(JSON.stringify({ settings, sources: payload.sources })).digest("hex");
  values.set(quizKey(owner) + ":j:" + id, { id, settings, sources: [], fingerprint, status: "completed", token: "private-worker-token", quizId: randomUUID() });
  const before = reads.length;
  const response = await POST(request("", owner, payload));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).job.token, undefined);
  assert.equal(reads.length, before + 1, "replay does not reload expired sources or rerun AI");
  assert.equal((await POST(request("", owner, { ...payload, settings: { ...settings, count: 1 } }))).status, 409);
});
