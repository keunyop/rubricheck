import assert from "node:assert/strict";
import test from "node:test";
import { parseDraft, DRAFT_TTL_MS } from "./evaluationDraft.ts";

test("restores empty and non-empty fields, modes, and file presence exactly", () => {
  const value = { rubricText: "Rubric\n???", assignmentText: "", rubricMode: "text", assignmentMode: "file", gradingMode: "strict", hadRubricFile: false, hadAssignmentFile: true, savedAt: 1000 };
  assert.deepEqual(parseDraft(JSON.stringify(value), 2000), value);
});
test("general criteria and saved rubric selections survive draft restoration", () => {
  const base = { rubricText: "", assignmentText: "An essay", assignmentMode: "text", gradingMode: "standard", savedAt: 1000 };
  const general = parseDraft(JSON.stringify({ ...base, rubricMode: "general", assignmentInstructions: "Compare sources." }), 2000)!;
  assert.equal(general.rubricMode, "general");
  assert.equal(general.assignmentInstructions, "Compare sources.");
  const savedRubric = { id: "a".repeat(64), name: "Essay", text: "Focus 100", files: [], lastUsedAt: 500 };
  const saved = parseDraft(JSON.stringify({ ...base, rubricMode: "library", savedRubric }), 2000)!;
  assert.equal(saved.rubricMode, "library");
  assert.deepEqual(saved.savedRubric, savedRubric);
  for (const item of [null, { ...savedRubric, id: "../other" }, { ...savedRubric, files: null }]) {
    assert.equal(parseDraft(JSON.stringify({ ...base, rubricMode: "library", savedRubric: item }), 2000)!.rubricMode, "file");
  }
});
test("invalid, expired or future drafts cannot be restored", () => {
  const value = { rubricText: "text", assignmentText: "essay", savedAt: 1000 };
  assert.equal(parseDraft("{"), null);
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft(JSON.stringify(value), 1000 + DRAFT_TTL_MS + 1), null);
  assert.equal(parseDraft(JSON.stringify(value), 999), null);
  assert.equal(parseDraft(JSON.stringify({ ...value, assignmentText: 1 }), 2000), null);
});
