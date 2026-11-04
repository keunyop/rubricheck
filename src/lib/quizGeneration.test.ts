import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { QuizJob, QuizSource } from "./quizTypes.ts";
import { QuizError } from "./quizValidation.ts";

const id = randomUUID(), sourceId = randomUUID();
let expires = false, rejectAll = false, modelCalls = 0;
let stages: { action: string; input: Record<string, unknown> }[] = [];
const source: QuizSource = { id: sourceId, name: "Geometry", kind: "text", unitKind: "paragraph", totalUnits: 1, segments: [{ unit: 1, text: "A triangle has three sides. A square has four equal sides." }], bytes: 0, receivedAt: Date.now(), expiresAt: Date.now() + 60_000, assignmentId: null, version: null, projectId: null };
const { segments, ...metadata } = source;
void segments;
const job = { id, token: "worker", settings: { title: "Geometry", projectId: null, count: 4, language: "en", difficulty: "standard", purpose: "concepts", topic: "" }, sources: [{ ...metadata, units: [1] }] } as QuizJob;
mock.module("./quizStore.ts", { namedExports: {
  claimQuizJob: async () => job,
  getQuizSource: async () => { if (expires) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410); return source; },
  quizTransaction: async (_email: string, action: string, input: Record<string, unknown>) => { stages.push({ action, input }); return { status: "validating" }; },
} });
mock.module("./evaluationRecovery.ts", { namedExports: { getEvaluation: async () => null } });
mock.module("../../lib/openai.ts", { namedExports: { callEvaluationModel: async (prompt: string, options: { systemInstruction: string }) => {
  modelCalls++;
  assert.match(options.systemInstruction.toLowerCase(), /untrusted/);
  const input = JSON.parse(prompt);
  if (input.questions) return { acceptedIndices: rejectAll ? [] : [0] };
  assert.equal(input.materials[0].segments.length, 1);
  return { questions: [
    { type: "mcq", question: "How many sides has a triangle?", options: ["Three", "Four", "Five", "Six"], answer: 0, explanation: "A triangle has three sides.", concepts: ["Triangle"], sourceId, unit: 1, evidence: "A triangle has three sides." },
    { type: "true_false", question: "A square has four equal sides.", options: ["O", "X"], answer: 0, explanation: "All four sides are equal.", concepts: ["Square"], sourceId, unit: 1, evidence: "A square has four equal sides." },
  ] };
} } });
const { runQuizJob } = await import("./quizGeneration.ts");

test("worker persists only independently accepted questions, without evidence copies", async () => {
  stages = []; modelCalls = 0;
  await runQuizJob("quiz@test.invalid", id);
  assert.equal(modelCalls, 2);
  const saved = stages.find(s => s.action === "finish")!.input.quiz as { questions: Record<string, unknown>[]; requestedCount: number };
  assert.equal(saved.requestedCount, 4);
  assert.equal(saved.questions.length, 1);
  assert.equal(saved.questions[0].evidence, undefined);
  assert.equal(stages.some(s => s.action === "fail"), false);
});

test("zero accepted questions fail without saving; source expiry prevents model calls", async () => {
  rejectAll = true; stages = []; modelCalls = 0;
  await runQuizJob("quiz@test.invalid", id);
  assert.equal(stages.at(-1)?.input.error, "QUIZ_INSUFFICIENT_SOURCE");
  assert.equal(stages.some(s => s.action === "finish"), false);
  expires = true; stages = []; modelCalls = 0;
  await runQuizJob("quiz@test.invalid", id);
  assert.equal(modelCalls, 0);
  assert.equal(stages.at(-1)?.input.error, "QUIZ_SOURCE_EXPIRED");
});
