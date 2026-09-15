import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../../src/lib/creditSession.ts";
import type { LabWorkspace } from "../../../../src/lib/assignmentLab/types.ts";

let modelFailure = false;
let gradeCalls = 0;
let coachingCalls = 0;
let malformedCoaching = 0;
const rubric = { criteria: [{ name: "Evidence", max_score: 10, description: "Cited support" }, { name: "Argument", max_score: 10, description: "Reasoning" }] };
mock.module("../../../../lib/rubricStructuring.ts", { namedExports: { structureRubric: async () => rubric } });
mock.module("../../../../lib/evaluation.ts", { namedExports: { evaluateAssignment: async () => {
  gradeCalls++; if (modelFailure) throw new Error("MODEL_FAILED");
  return { summary: "The draft needs supporting evidence.", top_improvements: ["Add a citation", "Explain the claim", "Review the conclusion"], criteria_scores: rubric.criteria.map(c => ({ name: c.name, score: 5, rationale: "Support is incomplete.", estimated_range: [4, 6], feedback: "Explain the source." })) };
} } });
mock.module("../../../../lib/openai.ts", { namedExports: { callEvaluationModel: async () => {
  coachingCalls++; if (malformedCoaching-- > 0) return { issues: [], reviews: [{ task_id: "invented", status: "remaining", reason: "Unknown", evidence: [] }] }; return { issues: [], reviews: [] };
} } });
const { GET, POST, DELETE } = await import("./route.ts");
const { POST: evaluate } = await import("./evaluate/route.ts");
const { POST: task } = await import("./task/route.ts");
const { POST: feedback } = await import("./feedback/route.ts");
const { POST: parse } = await import("./parse/route.ts");
const { labInputHash, conditionsFor } = await import("../../../../src/lib/assignmentLab/evaluate.ts");

test("private lab API validates identity, ownership, input, reuse, failure and plan boundaries", async t => {
  const previousEnv = { ...process.env }; const originalFetch = globalThis.fetch;
  Object.assign(process.env, { ENTITLEMENT_SESSION_SECRET: "lab-test-secret", ASSIGNMENT_LAB_EMAILS: "tester@example.com", SUPABASE_URL: "https://supabase.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-only", EVALUATION_MODEL: "test-evaluator", STRUCTURE_MODEL: "test-structure" });
  const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222";
  let saved: LabWorkspace = { assignment: { id, title: "Essay", mode: "standard", initial_draft: "Original draft", created_at: "2026-09-15", run_count: 0 }, rubric: { id: "33333333-3333-4333-8333-333333333333", raw_text: "Evidence and argument", structured: null, structure_model: null }, runs: [] };
  let unavailable = false, pending = false, loseReservation = false, loseCommit = false;
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    const name = new URL(String(input)).pathname.split("/").at(-1)!;
    const body = JSON.parse(String(init?.body ?? "{}")); calls.push({ name, body });
    if (unavailable) throw new Error("do not disclose service_role_secret");
    if (name === "lab_resolve_user") return Response.json(owner);
    if (name === "rubricheck_get_account_entitlement_by_email") return Response.json(null);
    if (body.p_assignment && body.p_assignment !== id) return new Response("LAB_NOT_FOUND", { status: 400 });
    if (name === "lab_list_assignments") return Response.json([saved.assignment]);
    if (name === "lab_get_workspace" || name === "lab_export_workspace") return Response.json(saved);
    if (name === "lab_create_assignment") return Response.json(id);
    if (name === "lab_begin_run") {
      if (loseReservation) { loseReservation = false; throw new Error("response lost"); }
      if (pending) return new Response("LAB_PENDING", { status: 400 });
      const cached = saved.runs.find(run => run.input_hash === body.p_hash);
      return Response.json(cached ? { reused: true, run_id: cached.id } : { reused: false });
    }
    if (name === "lab_finish_run") {
      if (!saved.runs.some(run => run.input_hash === body.p_hash)) {
        saved = { ...saved, rubric: { ...saved.rubric, structured: body.p_rubric, structure_model: body.p_conditions.structureModel }, runs: [...saved.runs, {
          id: "44444444-4444-4444-8444-444444444444", version: saved.runs.length + 1, draft_text: body.p_draft, input_hash: body.p_hash,
          conditions: body.p_conditions, result: body.p_result, tasks: body.p_tasks, created_at: "2026-09-15",
        }] };
      }
      if (loseCommit) { loseCommit = false; throw new Error("commit response lost"); }
      return Response.json(saved.runs.at(-1)!.id);
    }
    if (["lab_release_run", "lab_delete_assignment", "lab_set_task", "lab_save_feedback"].includes(name)) return Response.json(null);
    throw new Error("Unexpected network call " + name);
  };
  function request(path = "", body?: unknown, email: string | null = "tester@example.com", method = "POST", extra: Record<string, string> = {}) {
    return new Request("https://example.com/api/lab/assignments" + path, {
      method: body === undefined ? "GET" : method,
      headers: { ...(email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }) } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const creation = { id, title: "Essay", rubricText: "Evidence and argument", draftText: "Draft", mode: "standard" };
  try {
    await t.test("signed-out, forged, unauthorized and cross-site callers cannot reach storage", async () => {
      calls.length = 0;
      assert.equal((await GET(request("", undefined, null))).status, 401);
      assert.equal((await GET(request("", undefined, "stranger@example.com"))).status, 404);
      assert.equal((await GET(request("", undefined, null, "GET", { cookie: CREDIT_SESSION_COOKIE_NAME + "=forged.token" }))).status, 401);
      assert.equal((await POST(request("", creation, "tester@example.com", "POST", { origin: "https://evil.example" }))).status, 403);
      assert.equal(calls.length, 0);
    });
    await t.test("every API requires the verified tester session", async () => {
      for (const handler of [POST, DELETE, evaluate, task, feedback, parse]) assert.equal((await handler(request("", {}, null))).status, 401);
    });
    await t.test("normalizes verified identity into a stable user and disables response caching", async () => {
      calls.length = 0;
      const result = await GET(request());
      assert.equal(result.status, 200); assert.match(result.headers.get("Cache-Control")!, /no-store/);
      assert.match(String(calls[0].body.p_identity_hash), /^[a-f0-9]{64}$/);
      assert.equal(calls.find(c => c.name === "lab_list_assignments")!.body.p_owner, owner);
    });
    await t.test("rejects client-supplied owner, plan, rubric change, blank and oversized draft", async () => {
      assert.equal((await POST(request("", { ...creation, owner, pro: true }))).status, 400);
      assert.equal((await evaluate(request("/evaluate", { id, draftText: "Draft", mode: "strict" }))).status, 400);
      assert.equal((await evaluate(request("/evaluate", { id, draftText: "   " }))).status, 400);
      assert.equal((await evaluate(request("/evaluate", { id, draftText: "x".repeat(60001) }))).status, 400);
      assert.equal((await POST(request("", { ...creation, draftText: "x".repeat(600001) }))).status, 413);
    });
    await t.test("read, evaluate, export, task, feedback and deletion bind to the current owner", async () => {
      const other = "55555555-5555-4555-8555-555555555555";
      assert.equal((await GET(request("?id=" + other))).status, 404);
      assert.equal((await GET(request("?id=" + other + "&download=1"))).status, 404);
      assert.equal((await evaluate(request("/evaluate", { id: other, draftText: "Draft" }))).status, 404);
      assert.equal((await DELETE(request("", { id: other }, "tester@example.com", "DELETE"))).status, 404);
      assert.equal((await task(request("/task", { id: other, runId: id, taskKey: id, done: true }))).status, 404);
      assert.equal((await feedback(request("/feedback", { id: other, runId: id, helpful: true }))).status, 404);
    });
    await t.test("creation derives free plan server-side and never touches billing usage", async () => {
      calls.length = 0;
      assert.equal((await POST(request("", creation))).status, 201);
      assert.equal(calls.find(c => c.name === "lab_create_assignment")!.body.p_pro, false);
      assert.ok(!calls.some(c => /reserve.*credit|free_evaluate|settle/.test(c.name)));
    });
    await t.test("generation failure releases its reservation and leaves prior versions intact", async () => {
      calls.length = 0; modelFailure = true;
      assert.equal((await evaluate(request("/evaluate", { id, draftText: "Draft" }))).status, 500);
      assert.equal(saved.runs.length, 0);
      assert.ok(calls.some(c => c.name === "lab_release_run"));
      assert.ok(!calls.some(c => c.name === "lab_finish_run")); modelFailure = false;
    });
    await t.test("a lost reservation response releases only the request's token", async () => {
      calls.length = 0; loseReservation = true;
      assert.equal((await evaluate(request("/evaluate", { id, draftText: "Draft" }))).status, 503);
      assert.equal(calls.find(c => c.name === "lab_begin_run")!.body.p_token, calls.find(c => c.name === "lab_release_run")!.body.p_token);
    });
    await t.test("commit response loss retries idempotently and never creates a duplicate version", async () => {
      calls.length = 0; loseCommit = true; malformedCoaching = 1;
      const beforeCoaching = coachingCalls;
      const response = await evaluate(request("/evaluate", { id, draftText: "Draft" }));
      assert.equal(response.status, 200);
      assert.equal(saved.runs.length, 1);
      assert.equal(calls.filter(c => c.name === "lab_finish_run").length, 2);
      assert.equal(saved.runs[0].conditions.model, "test-evaluator");
      assert.equal(coachingCalls - beforeCoaching, 2, "malformed coaching is repaired once before saving");
      assert.deepEqual(saved.runs[0].result.overall_range, [40, 60]);
    });
    await t.test("same normalized input reuses the saved result without model calls", async () => {
      const before = [gradeCalls, coachingCalls];
      const response = await evaluate(request("/evaluate", { id, draftText: " Draft\r\n" }));
      assert.equal(response.status, 200); assert.equal((await response.json()).reused, true);
      assert.equal(saved.runs.length, 1); assert.deepEqual([gradeCalls, coachingCalls], before);
      const cond = conditionsFor(saved);
      assert.equal(labInputHash("x\r\ny", cond), labInputHash("x\ny", cond));
      assert.notEqual(labInputHash("x", cond), labInputHash("x", { ...cond, model: "changed-model" }));
    });
    await t.test("pending requests do not invoke the model; free export and delete are available", async () => {
      pending = true; const before = gradeCalls;
      assert.equal((await evaluate(request("/evaluate", { id, draftText: "New draft" }))).status, 409);
      assert.equal(gradeCalls, before); pending = false;
      const exported = await GET(request("?id=" + id + "&download=1"));
      assert.equal(exported.status, 200); assert.match(exported.headers.get("Content-Disposition")!, /attachment/);
      assert.equal((await DELETE(request("", { id }, "tester@example.com", "DELETE"))).status, 200);
    });
    await t.test("file upload supports readable TXT and rejects unsupported or empty files", async () => {
      const upload = async (name: string, text: string) => {
        const form = new FormData(); form.set("file", new File([text], name));
        return parse(new Request("https://example.com/api/lab/assignments/parse", { method: "POST", headers: { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: "tester@example.com" }) }, body: form }));
      };
      assert.equal((await upload("revision.txt", "A revised assignment with sufficient readable content.")).status, 200);
      assert.equal((await upload("file.exe", "executable")).status, 400);
      assert.equal((await upload("empty.txt", "")).status, 413);
    });
    await t.test("storage outages fail closed without leaking service details", async () => {
      unavailable = true;
      const response = await GET(request()); assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /service_role_secret/); unavailable = false;
    });
  } finally { globalThis.fetch = originalFetch; process.env = previousEnv; }
});


