import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Rubric } from "../../../lib/schema.ts";
import { generalRubric } from "../../../lib/generalRubric.ts";

let account: string | null = "student@example.com";
let structures = 0, saves = 0, touches = 0, reserves = 0, trials = 0;
let failLibrary = false, failEvaluation = false;
let selected: Rubric | undefined;
const settlements: boolean[] = [];
const custom = { criteria: [{ name: "Custom focus", max_score: 60, description: "Focus" }, { name: "Sources", max_score: 40, description: "Sources" }] };
const savedId = "a".repeat(64);
mock.module("../../../src/lib/creditSession.ts", { namedExports: { getCreditEmailFromCookie: () => account } });
mock.module("../../../lib/rubricStructuring.ts", { namedExports: {
  hashNormalizedEmail: () => "hash", structureRubric: async () => { structures++; return custom; },
} });
mock.module("../../../lib/evaluation.ts", { namedExports: {
  evaluateAssignment: async (rubric: Rubric) => {
    selected = rubric;
    if (failEvaluation) throw Error("EVALUATION_FAILED");
    return { summary: "The draft has a clear focus.", top_improvements: ["Explain examples", "Support claims", "Clarify wording"],
      criteria_scores: rubric.criteria.map(row => ({ name: row.name, score: Math.floor(row.max_score * 0.8), estimated_range: [Math.floor(row.max_score * 0.7), Math.floor(row.max_score * 0.9)], rationale: "Relevant discussion.", feedback: "Add supporting detail." })) };
  },
} });
mock.module("../../../src/lib/rubricLibrary.ts", { namedExports: {
  validRubricId: (id: unknown) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id),
  getSavedRubric: async (email: string, id: string) => {
    if (failLibrary) throw Error("offline");
    return email === "student@example.com" && id === savedId ? { id, text: "Custom rubric", rubric: custom, files: [] } : null;
  },
  saveRubric: async () => { saves++; if (failLibrary) throw Error("offline"); return savedId; },
  editSavedRubric: async () => { touches++; return !failLibrary; },
} });
mock.module("../../../src/lib/credits.ts", { namedExports: {
  getCreditBalanceForRequest: async () => 0, resolveCreditStorageTarget: async () => null,
} });
mock.module("../../../src/lib/accountEntitlements.ts", { namedExports: {
  getAccountEntitlementByEmail: async () => null, hasAccountEntitlementStore: () => false, isActiveProAccountEntitlement: () => false,
} });
mock.module("../../../src/lib/usageLimit.ts", { namedExports: {
  buildUsageLimitHeaders: () => ({}),
  checkUsageLimit: async () => { reserves++; return { allowed: true, freeReservation: {}, billingSource: "free" }; },
  settleUsageReservation: async (_usage: unknown, succeeded: boolean) => { settlements.push(succeeded); },
} });
mock.module("../../../src/lib/evaluationRecovery.ts", { namedExports: {
  saveEvaluation: async ({ result }: { result: object }) => ({ ...result, evaluation_id: "11111111-1111-4111-8111-111111111111" }),
} });
mock.module("../../../src/lib/assignmentWorkspace.ts", { namedExports: {
  archiveAssignment: async () => {}, getProject: async () => null,
} });
mock.module("../../../src/lib/guestTrial.ts", { namedExports: {
  TRIAL_TEXT_LIMIT: 20000, trialIdentity: () => ({}),
  reserveTrial: async () => { trials++; return {}; }, releaseTrial: async () => {},
  completeTrial: async (_reservation: unknown, { result }: { result: { title: string; overall_range: number[]; summary: string } }) => ({ guest_preview: true, title: result.title, overall_range: result.overall_range, summary: result.summary }),
  setTrialCookie: (response: Response) => response,
} });
const { POST } = await import("./route.ts");
function request(data: object) {
  return new Request("https://example.com/api/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignmentText: "An essay with clear purpose and supporting details.", ...data }) });
}

test("rubric sources use existing evaluation, access, and billing paths", async t => {
  await t.test("general criteria bypass structuring, total 100, and retain assignment instructions", async () => {
    const response = await POST(request({ rubricSource: "general", assignmentInstructions: "Compare two approaches." }));
    assert.equal(response.status, 200);
    assert.equal(structures, 0); assert.equal(saves, 0);
    assert.equal(reserves, 1); assert.deepEqual(settlements, [true]);
    assert.deepEqual(selected, generalRubric("Compare two approaches."));
    const result = await response.json();
    assert.equal(result.criteria.reduce((sum: number, row: { max_score: number }) => sum + row.max_score, 0), 100);
    assert.equal(result.access_tier, "free");
    assert.equal(result.grading_basis, "general");
  });
  await t.test("multipart general grading accepts assignment-only uploads", async () => {
    const form = new FormData();
    form.set("rubricSource", "general");
    form.set("assignmentInstructions", "Discuss sleep and learning.");
    form.set("assignment", new File(["Sufficient sleep supports student learning and concentration. Schools should consider later start times because rested students can focus better on their lessons."], "essay.txt", { type: "text/plain" }));
    assert.equal((await POST(new Request("https://example.com", { method: "POST", body: form }))).status, 200);
    assert.match(selected!.criteria[0].description, /Discuss sleep/);
  });
  await t.test("missing, mixed, malformed sources and excessive instructions cannot reserve usage", async () => {
    const before = reserves;
    for (const payload of [
      {}, { rubricSource: "unknown" }, { rubricSource: "saved" }, { rubricSource: "general", rubricText: "ignored?" },
      { rubricSource: "general", rubricId: savedId }, { rubricSource: "provided", rubricText: "Custom", assignmentInstructions: "ignored?" },
      { rubricSource: "general", assignmentInstructions: "a".repeat(5001) },
    ]) assert.equal((await POST(request(payload))).status, 400);
    const form = new FormData();
    form.set("mode", "invalid");
    const legacyModeError = await POST(new Request("https://example.com", { method: "POST", body: form }));
    assert.equal((await legacyModeError.json()).code, "INVALID_MODE");
    assert.equal(reserves, before);
  });
  await t.test("saved rubrics are reused without a model structuring call or duplicate save", async () => {
    assert.equal((await POST(request({ rubricSource: "saved", rubricId: savedId }))).status, 200);
    assert.deepEqual(selected, custom); assert.equal(structures, 0); assert.equal(touches, 1); assert.equal(saves, 0);
  });
  await t.test("foreign, removed, and unavailable rubrics fail before billing", async () => {
    const before = reserves;
    account = "other@example.com";
    assert.equal((await POST(request({ rubricSource: "saved", rubricId: savedId }))).status, 404);
    account = "student@example.com";
    assert.equal((await POST(request({ rubricSource: "saved", rubricId: "b".repeat(64) }))).status, 404);
    failLibrary = true;
    assert.equal((await POST(request({ rubricSource: "saved", rubricId: savedId }))).status, 503);
    failLibrary = false;
    assert.equal(reserves, before);
  });
  await t.test("ordinary grading succeeds even if library persistence fails", async () => {
    failLibrary = true;
    const response = await POST(request({ rubricText: "Custom rubric" }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-rubric-library-unavailable"), "1");
    assert.equal(structures, 1); assert.equal(saves, 1);
    assert.equal(settlements.at(-1), true);
    failLibrary = false;
  });
  await t.test("general model failures release the existing reservation and never save a rubric", async () => {
    failEvaluation = true;
    assert.equal((await POST(request({ rubricSource: "general" }))).status, 500);
    assert.equal(settlements.at(-1), false); assert.equal(saves, 1);
    failEvaluation = false;
  });
  await t.test("Strict access remains locked; guests can preview general grading without account charges", async () => {
    const before = reserves;
    assert.equal((await POST(request({ rubricSource: "general", mode: "strict" }))).status, 403);
    account = null;
    assert.equal((await POST(request({ rubricSource: "saved", rubricId: savedId }))).status, 401);
    const response = await POST(request({ rubricSource: "general" }));
    assert.equal(response.status, 200);
    const preview = await response.json();
    assert.equal(preview.guest_preview, true); assert.equal(preview.criteria, undefined);
    assert.equal(reserves, before); assert.equal(trials, 1); assert.equal(saves, 1);
  });
});
