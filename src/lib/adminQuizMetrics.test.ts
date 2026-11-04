import assert from "node:assert/strict";
import test from "node:test";
import { collectAdminQuizMetrics, getAdminQuizMetrics } from "./adminQuizMetrics.ts";

const key = (letter: string) => "rubricheck:quiz:{" + letter.repeat(64) + "}";
const now = 1_800_000_000_000;

test("quiz metrics count retained content, practice and job states without returning private content", async () => {
  const a = key("a"), b = key("b");
  const reads: string[] = [];
  const report = await collectAdminQuizMetrics({
    scan: async cursor => cursor === "0" ? ["1", [a, a, a + ":source:private", "rubricheck:other"]] : ["0", [a, b]],
    hscan: async (owner, cursor, options) => {
      assert.equal(options.match, "[qjt]:*"); reads.push(owner + ":" + cursor);
      if (owner === b) return ["0", ["j:failed", { status: "failed", error: "QUIZ_GENERATION_FAILED" }, "j:interrupted", { status: "failed", error: "QUIZ_INTERRUPTED" }]];
      if (cursor === "0") return ["1", [
        "q:one", JSON.stringify({ title: "PRIVATE TITLE", questions: [{ question: "PRIVATE QUESTION" }, {}] }),
        "t:done", { kind: "full", completedAt: now },
        "t:review", { kind: "review", completedAt: null },
        "j:success", { status: "completed", sources: [{ name: "PRIVATE SOURCE" }] },
      ]];
      return ["0", [
        "q:one", { questions: [{}, {}] }, // SCAN may repeat keys/fields.
        "j:queued", { status: "queued", leaseUntil: now + 1 },
        "j:running", { status: "generating", leaseUntil: now + 1 },
        "j:validating", { status: "validating", leaseUntil: now + 1 },
        "j:expired", { status: "generating", leaseUntil: now },
      ]];
    },
  }, { now });
  assert.deepEqual(report.totals, { users: 2, quizzes: 1, questions: 2, attempts: 2, completedAttempts: 1, reviewAttempts: 1 });
  assert.deepEqual(report.generation, { completed: 1, failed: 1, inProgress: 3, interrupted: 2 });
  assert.equal(report.coverage, "complete");
  assert.equal(report.scannedAccounts, 2);
  assert.equal(report.scannedRecords, 10);
  assert.equal(reads.length, 3);
  assert.ok(!JSON.stringify(report).includes("PRIVATE"));
  assert.ok(!JSON.stringify(report).includes(a));
});

test("record and account caps yield explicit partial minimums, not apparent global totals", async () => {
  const reader = {
    scan: async (): Promise<[string, string[]]> => ["0", [key("a"), key("b"), key("c")]],
    hscan: async (): Promise<[string, unknown[]]> => ["0", ["q:one", { questions: [{}] }, "q:two", { questions: [{}, {}] }, "t:one", { kind: "full", completedAt: null }]],
  };
  const records = await collectAdminQuizMetrics(reader, { now, limits: { records: 2 } });
  assert.equal(records.coverage, "partial");
  assert.equal(records.scannedRecords, 2);
  assert.equal(records.totals.quizzes, 2);
  assert.equal(records.totals.questions, 3);
  const accounts = await collectAdminQuizMetrics(reader, { now, limits: { accounts: 1 } });
  assert.equal(accounts.coverage, "partial");
  assert.equal(accounts.scannedAccounts, 1);
  assert.equal(accounts.totals.quizzes, 2);
});

test("empty scan pages and huge single accounts have a bounded command budget", async () => {
  let calls = 0;
  const empty = await collectAdminQuizMetrics({
    scan: async () => { calls++; return ["1", []]; },
    hscan: async () => { throw new Error("not expected"); },
  }, { limits: { commands: 3 } });
  assert.equal(calls, 3); assert.equal(empty.coverage, "partial");
  calls = 0;
  const large = await collectAdminQuizMetrics({
    scan: async () => { calls++; return ["0", [key("a")]]; },
    hscan: async () => { calls++; return ["1", ["q:one", { questions: [{}] }]]; },
  }, { limits: { commands: 3 } });
  assert.equal(calls, 3); assert.equal(large.coverage, "partial");
  assert.equal(large.totals.quizzes, 1);
});

test("a genuinely empty store returns zero while unavailable or malformed reads reject", async () => {
  const empty = await collectAdminQuizMetrics({ scan: async () => ["0", []], hscan: async () => ["0", []] });
  assert.equal(empty.coverage, "complete"); assert.equal(empty.totals.quizzes, 0);
  await assert.rejects(collectAdminQuizMetrics({ scan: async () => { throw new Error("offline"); }, hscan: async () => ["0", []] }), /offline/);
  await assert.rejects(collectAdminQuizMetrics({ scan: async () => ["0", [key("a")]], hscan: async () => ["0", ["q:broken", "not-json"]] }));
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  try { delete process.env.UPSTASH_REDIS_REST_URL; await assert.rejects(getAdminQuizMetrics(), /QUIZ_METRICS_UNAVAILABLE/); }
  finally { if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = previousUrl; }
});
