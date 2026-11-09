import assert from "node:assert/strict";
import test from "node:test";
import { collectAdminQuizList, readAdminQuizDetail } from "./adminQuizLibrary.ts";

const owner = "a".repeat(64);
const key = `rubricheck:quiz:{${owner}}`;
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

function quiz(id: string, title: string, createdAt: number) {
  return {
    id,
    title,
    createdAt,
    requestedCount: 1,
    settings: { language: "en", difficulty: "standard", purpose: "concepts", topic: "Cells" },
    sources: [{ id: "source-1", name: "Biology notes.pdf", kind: "pdf", unitKind: "page", units: [2] }],
    questions: [{ id: "question-1", type: "mcq", question: "What is ATP?", options: ["Energy carrier", "A cell wall"], answer: 0, explanation: "ATP carries energy.", concepts: ["ATP"], sourceId: "source-1", unit: 2 }],
  };
}

test("admin quiz list scans saved quizzes, de-duplicates fields, filters, sorts, and paginates", async () => {
  const first = quiz(firstId, "Older quiz", 100);
  const second = quiz(secondId, "Cell biology", 200);
  const result = await collectAdminQuizList({
    scan: async () => ["0", [key, key, `${key}:source:private`]],
    hscan: async (_key, cursor, options) => {
      assert.equal(options.match, "q:*");
      return cursor === "0"
        ? ["1", [`q:${firstId}`, first, `q:${secondId}`, JSON.stringify(second)]]
        : ["0", [`q:${secondId}`, second, "q:broken", "not-json"]];
    },
  }, { query: "cell", limit: 1, now: 1_000 });
  assert.equal(result.coverage, "complete");
  assert.equal(result.scannedAccounts, 1);
  assert.equal(result.scannedQuizzes, 3);
  assert.equal(result.total, 1);
  assert.deepEqual(result.items.map(item => item.id), [secondId]);
  assert.equal(result.items[0].questionCount, 1);
  assert.deepEqual(result.items[0].sourceNames, ["Biology notes.pdf"]);
  assert.ok(!JSON.stringify(result).includes("What is ATP?"));
});

test("admin quiz detail validates identifiers and returns questions with their source names", async () => {
  let reads = 0;
  const reader = { hget: async () => { reads++; return quiz(secondId, "Cell biology", 200); } };
  assert.equal(await readAdminQuizDetail(reader, "not-an-owner", secondId), null);
  assert.equal(reads, 0);
  const detail = await readAdminQuizDetail(reader, owner, secondId);
  assert.equal(reads, 1);
  assert.equal(detail?.questions[0].sourceName, "Biology notes.pdf");
  assert.equal(detail?.questions[0].options[0], "Energy carrier");
  assert.equal(detail?.questions[0].answer, 0);
});

test("admin quiz list reports partial coverage when its command budget is exhausted", async () => {
  const result = await collectAdminQuizList({
    scan: async () => ["1", [key]],
    hscan: async () => ["1", [`q:${firstId}`, quiz(firstId, "Quiz", 100)]],
  }, { limits: { commands: 2 } });
  assert.equal(result.coverage, "partial");
  assert.equal(result.items.length, 1);
});
