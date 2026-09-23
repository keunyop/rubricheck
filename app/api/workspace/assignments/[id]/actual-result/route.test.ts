import assert from "node:assert/strict";
import { test } from "node:test";
import { GET, PUT, DELETE } from "./route.ts";
import { CREDIT_SESSION_COOKIE_NAME, createCreditSessionToken } from "../../../../../../src/lib/creditSession.ts";
import { ownerHash } from "../../../../../../src/lib/evaluationRecovery.ts";
import { workspaceKey } from "../../../../../../src/lib/assignmentWorkspace.ts";
import type { ActualResult } from "../../../../../../src/lib/actualResultTypes.ts";

const id = "ae7f951b-1810-4f55-90c2-029899442ff1";
const owner = "student@example.com", other = "other@example.com";
const input = { score: 17, maxScore: 20, comment: "More sources next time.", course: "History",
  assignmentType: "essay", submissionMatch: "same",
  consent: { personalRecord: true, qualityValidation: false, publicCase: false }, expectedRevision: null };

test("actual result API isolates accounts, validates consent, retains estimates and prevents stale consent writes", async () => {
  const oldFetch = globalThis.fetch, oldEnv = { ...process.env };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  const archiveKey = workspaceKey(owner) + ":result:" + id;
  const actualKey = archiveKey + ":actual";
  const archive = { owner: ownerHash(owner), mode: "standard", result: {
    evaluation_id: id, title: "History essay", access_tier: "free", overall_range: [70, 80],
    summary: "Support claims.", top_improvements: ["More sources"],
    criteria: [{ name: "Evidence", score: 75, max_score: 100, rationale: "Sources", feedback: "Sources", estimated_range: [70, 80] }],
  } };
  const values = new Map([[archiveKey, JSON.stringify(archive)]]);
  let calls = 0;
  function command(parts: unknown[]) {
    calls++;
    const [raw, scriptOrKey, ...args] = parts;
    const op = String(raw).toLowerCase();
    if (op === "get") return values.get(String(scriptOrKey)) ?? null;
    if (op === "eval") {
      const count = Number(args[0]), keys = args.slice(1, count + 1).map(String), argv = args.slice(count + 1).map(String);
      const archived = values.get(keys[1]);
      const deleting = argv.length === 2;
      if (!archived || JSON.parse(archived).owner !== argv[deleting ? 1 : 2]) return 0;
      const rawPrevious = values.get(keys[0]), previous = rawPrevious ? JSON.parse(rawPrevious) as ActualResult : null;
      if (deleting && !previous) return 1;
      if ((previous?.revision ?? "") !== argv[0]) return -1;
      if (deleting) { values.delete(keys[0]); return 1; }
      const next = JSON.parse(argv[1]) as ActualResult;
      if (previous) {
        next.estimate = previous.estimate; next.createdAt = previous.createdAt;
        if (JSON.stringify(next.consent) === JSON.stringify(previous.consent)) next.consentUpdatedAt = previous.consentUpdatedAt;
      }
      const encoded = JSON.stringify(next); values.set(keys[0], encoded); return encoded;
    }
    throw Error("Unexpected Redis operation: " + op);
  }
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    return Response.json(Array.isArray(body[0]) ? body.map((part: unknown[]) => ({ result: command(part) })) : { result: command(body) });
  };
  const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
  function request(method: string, email: string | null = owner, body?: unknown, rawBody?: string) {
    return new Request("https://example.com/api/workspace/assignments/" + id + "/actual-result", {
      method, headers: { "content-type": "application/json", ...(email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }) } : {}) },
      ...(method === "GET" ? {} : { body: rawBody ?? JSON.stringify(body) }),
    });
  }
  async function save(body: unknown = input, email = owner) { return PUT(request("PUT", email, body), context()); }
  try {
    for (const [method, handler] of [["GET", GET], ["PUT", PUT], ["DELETE", DELETE]] as const) {
      assert.equal((await handler(request(method, null, input), context())).status, 401);
    }
    assert.equal(calls, 0);
    assert.equal((await GET(request("GET"), context("../invalid"))).status, 404);
    assert.equal(calls, 0);
    assert.equal((await GET(request("GET", other), context())).status, 404);
    assert.equal((await save(input, other)).status, 404);
    assert.equal((await DELETE(request("DELETE", other, { expectedRevision: null }), context())).status, 404);
    const empty = await GET(request("GET"), context());
    assert.equal(empty.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await empty.json(), { actualResult: null });
    for (const patch of [{ score: 21 }, { maxScore: 0 }, { score: "17" }, { comment: "x".repeat(5001) },
      { consent: { personalRecord: true } }, { consent: { ...input.consent, personalRecord: false } },
      { estimate: { overallRange: [99, 100] } }, { owner: other }, { expectedRevision: undefined }]) {
      assert.equal((await save({ ...input, ...patch })).status, 400);
    }
    assert.equal((await PUT(request("PUT", owner, undefined, "{"), context())).status, 400);
    assert.equal((await PUT(request("PUT", owner, undefined, "x".repeat(32001)), context())).status, 413);
    const saved = await save();
    assert.equal(saved.status, 200);
    const original: ActualResult = (await saved.json()).actualResult;
    assert.equal(original.score, 17);
    assert.equal(original.maxScore, 20);
    assert.equal(original.consent.qualityValidation, false);
    assert.equal(original.consent.publicCase, false);
    assert.equal(original.consentVersion, "actual-results-v1");
    assert.deepEqual(original.estimate.overallRange, [70, 80]);
    assert.equal(original.estimate.provenance, null);
    assert.equal(original.estimate.scoringVersion, null);
    assert.equal(values.get(archiveKey), JSON.stringify(archive));
    assert.deepEqual((await (await GET(request("GET"), context())).json()).actualResult, original);
    assert.equal((await save()).status, 409);
    const [one, two] = await Promise.all([
      save({ ...input, expectedRevision: original.revision, consent: { ...input.consent, qualityValidation: true } }),
      save({ ...input, expectedRevision: original.revision, consent: { ...input.consent, publicCase: true } }),
    ]);
    assert.deepEqual([one.status, two.status].sort(), [200, 409]);
    let current = JSON.parse(values.get(actualKey)!) as ActualResult;
    // Even if an archive later changes, edits compare with the frozen original estimate.
    values.set(archiveKey, JSON.stringify({ ...archive, result: { ...archive.result, overall_range: [90, 100] } }));
    const revoked = await save({ ...input, score: 0, comment: "", expectedRevision: current.revision });
    assert.equal(revoked.status, 200);
    current = (await revoked.json()).actualResult;
    assert.equal(current.score, 0);
    assert.deepEqual(current.estimate, original.estimate);
    assert.equal(current.createdAt, original.createdAt);
    assert.equal(current.consent.qualityValidation, false);
    assert.equal(current.consent.publicCase, false);
    assert.equal((await save({ ...input, expectedRevision: original.revision, consent: { ...input.consent, publicCase: true } })).status, 409);
    assert.equal((await DELETE(request("DELETE", owner, { expectedRevision: original.revision }), context())).status, 409);
    assert.equal((await DELETE(request("DELETE", owner, {}), context())).status, 400);
    const commentOnly = await save({ ...input, score: null, expectedRevision: current.revision });
    current = (await commentOnly.json()).actualResult;
    assert.equal(current.score, null);
    const deleted = await DELETE(request("DELETE", owner, { expectedRevision: current.revision }), context());
    assert.equal(deleted.status, 200);
    assert.equal(values.has(actualKey), false);
    assert.equal(values.has(archiveKey), true);
    assert.equal((await DELETE(request("DELETE", owner, { expectedRevision: current.revision }), context())).status, 200);
    // Private data never appears in an unauthorized read after deletion either.
    assert.equal((await GET(request("GET", other), context())).status, 404);
    delete process.env.UPSTASH_REDIS_REST_URL;
    assert.equal((await GET(request("GET"), context())).status, 503);
    assert.equal((await save()).status, 503);
    assert.equal((await DELETE(request("DELETE", owner, { expectedRevision: null }), context())).status, 503);
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of ["ENTITLEMENT_SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
      if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
    }
  }
});
