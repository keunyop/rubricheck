import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRevisionTasks } from "./coaching.ts";
import { compareConditions, compareCriteria, type LabTask, type LabRun, type LabConditions } from "./types.ts";

const task: LabTask = {
  task_key: "11111111-1111-4111-8111-111111111111", criterion_index: 0,
  title: "Connect the source to the claim", reason: "The source is listed without explanation.",
  required_evidence: "Explain how the source supports the claim.", question: "How does this support the claim?",
  status: "new", review_reason: "", evidence: [], user_done: true,
};
test("task completion is based on a verified current-draft quote, independently of the checkbox", () => {
  const tasks = buildRevisionTasks({ issues: [], reviews: [{ task_id: task.task_key, status: "resolved", reason: "The link is explained.", evidence: ["This source supports the claim."] }] }, [task], 2, "This source supports the claim.");
  assert.equal(tasks[0].status, "resolved");
  assert.equal(tasks[0].user_done, false);
  assert.equal(tasks[0].task_key, task.task_key);
});
test("hallucinated resolution evidence becomes uncertain and is not shown", () => {
  const tasks = buildRevisionTasks({ issues: [], reviews: [{ task_id: task.task_key, status: "resolved", reason: "Fixed.", evidence: ["Invented quote"] }] }, [task], 2, "Unchanged text.");
  assert.equal(tasks[0].status, "uncertain");
  assert.deepEqual(tasks[0].evidence, []);
  assert.doesNotMatch(tasks[0].review_reason, /Fixed/);
});
test("a recurring resolved omission is flagged as new without losing its stable ID", () => {
  const tasks = buildRevisionTasks({ issues: [], reviews: [{ task_id: task.task_key, status: "remaining", reason: "The source link was removed.", evidence: [] }] }, [{ ...task, status: "resolved" }], 2, "Text");
  assert.equal(tasks[0].status, "new");
  assert.equal(tasks[0].task_key, task.task_key);
});
test("missing, duplicate, foreign and out-of-rubric task reviews are rejected", () => {
  const review = { task_id: task.task_key, status: "remaining", reason: "Still missing.", evidence: [] };
  assert.throws(() => buildRevisionTasks({ issues: [], reviews: [] }, [task], 2, "Text"), /INCOMPLETE/);
  assert.throws(() => buildRevisionTasks({ issues: [], reviews: [review, review] }, [task], 2, "Text"), /INVALID/);
  assert.throws(() => buildRevisionTasks({ issues: [], reviews: [{ ...review, task_id: "22222222-2222-4222-8222-222222222222" }] }, [task], 2, "Text"), /INVALID/);
  const issue = { criterion_index: 2, title: "Issue", reason: "Reason", required_evidence: "Evidence", question: "Question?" };
  assert.throws(() => buildRevisionTasks({ issues: [issue], reviews: [] }, [], 2, "Text"), /INVALID_TASK_CRITERION/);
});
test("duplicate issues are not silently added as separate progress items", () => {
  const issue = { criterion_index: 0, title: "Issue", reason: "Reason", required_evidence: "Evidence", question: "Question?" };
  assert.throws(() => buildRevisionTasks({ issues: [issue, issue], reviews: [] }, [], 2, "Text"), /DUPLICATE/);
});
const conditions: LabConditions = { rubricVersionId: "rubric", mode: "standard", model: "model", evaluationPromptVersion: "e1", coachingPromptVersion: "c1", structureModel: "s1", structurePromptVersion: "s1", scoringVersion: "v2" };
const makeRun = (score: number, cond = conditions): LabRun => ({
  id: "run", version: 1, draft_text: "Text", input_hash: "hash", conditions: cond, tasks: [], created_at: "2026-09-15",
  result: { title: "Test", access_tier: "topup", overall_range: [50, 70], summary: "Test.", top_improvements: [], criteria: [{ name: "Evidence", score, max_score: 10, rationale: "Test", estimated_range: [score - 1, score + 1], feedback: "Test" }] },
});
test("comparison preserves negative and zero changes and blocks deltas when conditions change", () => {
  assert.equal(compareCriteria(makeRun(7), makeRun(5))[0].delta, -2);
  assert.equal(compareCriteria(makeRun(7), makeRun(7))[0].delta, 0);
  for (const key of Object.keys(conditions) as Array<keyof LabConditions>) {
    const changed = { ...conditions, [key]: "changed" } as LabConditions;
    assert.deepEqual(compareConditions(conditions, changed), [key]);
    assert.equal(compareCriteria(makeRun(7), makeRun(8, changed))[0].delta, null);
  }
  const renamed = makeRun(8); renamed.result.criteria[0].name = "Other";
  assert.equal(compareCriteria(makeRun(7), renamed)[0].delta, null);
});

