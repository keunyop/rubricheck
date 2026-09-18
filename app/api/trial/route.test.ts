import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";

// In-memory Redis boundary: atomic operations and injected lost responses.
const values = new Map<string, string>();
const ttls = new Map<string, number>();
let dropReserve = false, dropComplete = false, storageDown = false;
const read = (key: string) => {
  const raw = values.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
};
class Redis {
  async get(key: string) { if (storageDown) throw Error("offline"); return read(key); }
  async eval(script: string, keys: string[], args: unknown[]) {
    if (storageDown) throw Error("offline");
    const set = (key: string, value: unknown, ttl: unknown) => { values.set(key, String(value)); ttls.set(key, Number(ttl)); };
    if (script.includes("local a =")) {
      if (keys.some(key => values.get(key) === "used")) return 0;
      if (keys.some(key => values.has(key))) return -1;
      keys.forEach(key => set(key, args[0], args[1]));
      if (dropReserve) { dropReserve = false; throw Error("lost reserve reply"); }
      return 1;
    }
    if (script.includes("for i = 1, 2")) {
      keys.forEach(key => { if (values.get(key) === args[0]) values.delete(key); });
      return 1;
    }
    if (keys.length === 3) {
      if (keys.slice(0, 2).some(key => values.get(key) !== args[0])) return 0;
      assert.ok(script.includes("ARGV[5]"), "network retention is separate from browser retention");
      set(keys[2], args[1], args[2]); set(keys[0], "used", args[3]); set(keys[1], "used", args[4]);
      if (dropComplete) { dropComplete = false; throw Error("lost completion reply"); }
      return 1;
    }
    if (script.includes("cjson.decode(raw)")) {
      const record = read(keys[0]);
      if (!record || (record.owner && record.owner !== args[0])) return 0;
      set(keys[0], args[1], args[2]);
      if (!values.has(keys[1])) set(keys[1], args[1], args[2]);
      return 1;
    }
    throw Error("Unexpected Redis script");
  }
}
mock.module("@upstash/redis", { namedExports: { Redis } });
let modelCalls = 0, failure = "", gate: Promise<void> | null = null;
const rubric = { criteria: [{ name: "Evidence", max_score: 100, description: "Credible evidence" }] };
const evaluation = { summary: "Your argument is clear.", top_improvements: ["Use sources", "Explain evidence", "Revise transitions"],
  criteria_scores: [{ name: "Evidence", score: 75, rationale: "Private rationale", estimated_range: [70, 80], feedback: "Private criterion feedback", evidence: ["Private quote"] }] };
mock.module("../../../lib/rubricStructuring.ts", { namedExports: {
  hashNormalizedEmail: () => "hash",
  structureRubric: async () => { if (failure === "rubric") throw Error("RUBRIC_STRUCTURE_FAILED"); return rubric; },
} });
mock.module("../../../lib/evaluation.ts", { namedExports: {
  evaluateAssignment: async () => { modelCalls++; if (gate) await gate; if (failure === "model") throw Error("OPENAI_TIMEOUT"); return failure === "finalization" ? { ...evaluation, criteria_scores: [] } : evaluation; },
} });
let archived = 0;
mock.module("../../../src/lib/assignmentWorkspace.ts", { namedExports: {
  archiveAssignment: async () => { archived++; }, getProject: async () => { throw Error("Guests must not access projects"); },
} });
mock.module("../../../src/lib/abuseTelemetry.ts", { namedExports: {
  getPayloadSizeApprox: () => 0, recordAbuseTelemetry: async () => ({ suspicious: false }), shouldEnforceForSuspicious: () => false,
} });
const { POST: grade } = await import("../grade/route.ts");
const { POST: evaluate } = await import("../evaluate/route.ts");
const { GET: status, POST: claim } = await import("./route.ts");
const { trialIdentity, reserveTrial, releaseTrial, completeTrial, readTrial } = await import("../../../src/lib/guestTrial.ts");
const { buildFinalEvaluation } = await import("../../../lib/gradeFinalization.ts");
const { getEvaluation } = await import("../../../src/lib/evaluationRecovery.ts");
const token = "a".repeat(64);
function request(options: { token?: string; ip?: string; email?: string; mode?: string; assignment?: string; project?: string } = {}) {
  return new Request("https://example.com/api/evaluate", { method: "POST", headers: {
    "content-type": "application/json", "x-forwarded-for": options.ip ?? "203.0.113.10",
    cookie: "rubricheck_guest_trial=" + (options.token ?? token) + (options.email ? "; " + CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: options.email }) : ""),
    ...(options.project ? { "x-project-id": options.project } : {}),
  }, body: JSON.stringify({ mode: options.mode ?? "standard", rubricText: "Evidence: 100 points", assignmentText: options.assignment ?? "A supported argument." }) });
}
test("guest previews enforce access, one use, retries and account ownership without billing", async t => {
  const env = { ...process.env }, oldFetch = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  process.env.ENTITLEMENT_SESSION_SECRET = "test-secret";
  globalThis.fetch = async () => { throw Error("Unexpected external network or billing call"); };
  const reset = () => { values.clear(); ttls.clear(); modelCalls = 0; archived = 0; failure = ""; gate = null; dropReserve = false; dropComplete = false; storageDown = false; };
  try {
    await t.test("sample-independent status creates a secure opaque cookie without using a check", async () => {
      reset();
      const response = await status(new Request("https://example.com/api/trial"));
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie")!, /rubricheck_guest_trial=[a-f0-9]{64}/);
      assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.deepEqual(await response.json(), { used: false, pending: false, result: null });
      assert.equal(values.size, 0); assert.equal(modelCalls, 0);
    });
    await t.test("parallel tabs, changed cookie and changed IP cannot duplicate a reservation", async () => {
      reset();
      const identity = trialIdentity(request());
      const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => reserveTrial(identity)));
      assert.equal(attempts.filter(item => item.status === "fulfilled").length, 1);
      await assert.rejects(reserveTrial(trialIdentity(request({ token: "b".repeat(64) }))), /TRIAL_PENDING/);
      await assert.rejects(reserveTrial(trialIdentity(request({ ip: "203.0.113.11" }))), /TRIAL_PENDING/);
      const winner = attempts.find(item => item.status === "fulfilled");
      assert.ok(winner?.status === "fulfilled");
      await releaseTrial({ ...winner.value, lease: "wrong-lease" });
      assert.equal((await readTrial(identity)).pending, true);
      await releaseTrial(winner.value);
      assert.equal((await readTrial(identity)).pending, false);
    });
    await t.test("a lost reservation response releases only its own lease", async () => {
      reset(); dropReserve = true;
      await assert.rejects(reserveTrial(trialIdentity(request())), /lost reserve reply/);
      assert.equal(values.size, 0);
      await reserveTrial(trialIdentity(request()));
    });
    for (const kind of ["rubric", "model", "finalization"]) await t.test(kind + " failure restores the preview", async () => {
      reset(); failure = kind;
      const response = await grade(request());
      assert.equal(response.status, kind === "rubric" ? 400 : kind === "model" ? 504 : 500);
      assert.equal((await readTrial(trialIdentity(request()))).used, false);
      assert.equal(values.size, 0);
      failure = "";
      assert.equal((await grade(request())).status, 200);
    });
    await t.test("invalid files, excessive text, strict mode and project access never reach the model", async () => {
      reset();
      assert.equal((await grade(request({ mode: "strict" }))).status, 403);
      assert.equal((await grade(request({ project: "someone-elses-project" }))).status, 401);
      assert.equal((await grade(request({ assignment: "x".repeat(20001) }))).status, 400);
      const form = new FormData(); form.set("rubric", new File(["invalid"], "rubric.exe")); form.set("assignmentText", "A draft.");
      const base = request();
      assert.equal((await grade(new Request(base.url, { method: "POST", headers: { cookie: base.headers.get("cookie")!, "x-forwarded-for": "203.0.113.10" }, body: form }))).status, 400);
      assert.equal(values.size, 0); assert.equal(modelCalls, 0);
    });
    await t.test("successful evaluation returns only the summary and blocks every subsequent guest check", async () => {
      reset();
      const response = await evaluate(request());
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.deepEqual(Object.keys(data).sort(), ["guest_preview", "overall_range", "summary", "title"]);
      assert.equal(JSON.stringify(data).includes("Private"), false);
      assert.equal(modelCalls, 1); assert.equal(archived, 0);
      assert.deepEqual((await (await status(request())).json()).result, data);
      for (const req of [request(), request({ token: "b".repeat(64) }), request({ ip: "203.0.113.11" })]) {
        const blocked = await grade(req); assert.equal(blocked.status, 429);
        assert.equal((await blocked.json()).code, "TRIAL_LIMIT_REACHED");
      }
      assert.equal(modelCalls, 1);
      assert.equal(ttls.get(trialIdentity(request()).keys[1]), 86400);
    });
    await t.test("TXT uploads use the same limited preview", async () => {
      reset();
      const form = new FormData(); form.set("rubric", new File(["Evidence clarity and credible sources: 100 points."], "rubric.txt")); form.set("assignment", new File(["This draft presents a supported argument with enough meaningful text to be read."], "draft.txt"));
      const base = request();
      assert.equal((await grade(new Request(base.url, { method: "POST", headers: { cookie: base.headers.get("cookie")!, "x-forwarded-for": "203.0.113.10" }, body: form }))).status, 200);
      assert.equal(modelCalls, 1);
    });
    await t.test("pending request is rejected before a second model invocation", async () => {
      reset();
      let unblock!: () => void; gate = new Promise<void>(resolve => { unblock = resolve; });
      const running = grade(request());
      while (!modelCalls) await new Promise(resolve => setImmediate(resolve));
      assert.equal((await grade(request())).status, 409);
      unblock(); assert.equal((await running).status, 200);
      assert.equal(modelCalls, 1);
    });
    await t.test("lost completion response still delivers the saved summary", async () => {
      reset(); dropComplete = true;
      assert.equal((await grade(request())).status, 200);
      assert.equal((await readTrial(trialIdentity(request()))).used, true);
    });
    await t.test("signup claims original feedback once without evaluation or usage charges", async () => {
      reset(); await grade(request());
      assert.equal((await claim(request())).status, 401);
      assert.equal((await claim(request({ token: "b".repeat(64), email: "student@example.com" }))).status, 404);
      const response = await claim(request({ email: "student@example.com" }));
      assert.equal(response.status, 200);
      const { result } = await response.json();
      assert.equal(result.criteria[0].feedback, "Private criterion feedback");
      assert.equal(result.access_tier, "free");
      assert.equal(result.top_improvements.length, 1);
      assert.equal(result.criteria[0].detailed_breakdown_locked, true);
      assert.equal((await (await claim(request({ email: "student@example.com" }))).json()).result.evaluation_id, result.evaluation_id);
      assert.equal((await claim(request({ email: "other@example.com" }))).status, 404);
      assert.equal(await getEvaluation(result.evaluation_id, "other@example.com"), null);
      assert.equal((await readTrial(trialIdentity(request()))).result, null);
      assert.equal(modelCalls, 1); assert.equal(archived, 2);
    });
    await t.test("simultaneous different accounts cannot both claim the same result", async () => {
      reset(); await grade(request());
      const responses = await Promise.all([claim(request({ email: "one@example.com" })), claim(request({ email: "two@example.com" }))]);
      assert.deepEqual(responses.map(item => item.status).sort(), [200, 404]);
    });
    await t.test("expired preview cannot be claimed", async () => {
      reset();
      const reservation = await reserveTrial(trialIdentity(request()));
      await completeTrial(reservation, { rubric, assignmentText: "Text", result: buildFinalEvaluation(rubric, evaluation as Parameters<typeof buildFinalEvaluation>[1], "standard", "free") });
      const key = [...values.keys()].find(key => key.includes(":result:"))!;
      const record = read(key); record.expiresAt = Date.now() - 1; values.set(key, JSON.stringify(record));
      assert.equal((await claim(request({ email: "student@example.com" }))).status, 404);
      assert.equal((await readTrial(trialIdentity(request()))).result, null);
    });
    await t.test("storage outage fails closed before any model call", async () => {
      reset(); storageDown = true;
      assert.equal((await grade(request())).status, 503);
      assert.equal((await status(request())).status, 503);
      assert.equal(modelCalls, 0);
    });
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});

