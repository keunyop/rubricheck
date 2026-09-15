import assert from "node:assert/strict";
import test from "node:test";
import { parseDraft, DRAFT_TTL_MS } from "./evaluationDraft.ts";

test("restores empty and non-empty fields, modes, and file presence exactly", () => {
  const value = { rubricText: "Rubric\n???", assignmentText: "", rubricMode: "text", assignmentMode: "file", gradingMode: "strict", hadRubricFile: false, hadAssignmentFile: true, savedAt: 1000 };
  assert.deepEqual(parseDraft(JSON.stringify(value), 2000), value);
});
test("invalid, expired or future drafts cannot be restored", () => {
  const value = { rubricText: "text", assignmentText: "essay", savedAt: 1000 };
  assert.equal(parseDraft("{"), null);
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft(JSON.stringify(value), 1000 + DRAFT_TTL_MS + 1), null);
  assert.equal(parseDraft(JSON.stringify(value), 999), null);
  assert.equal(parseDraft(JSON.stringify({ ...value, assignmentText: 1 }), 2000), null);
});
