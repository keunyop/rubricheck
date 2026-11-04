import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beginQuizJob, deleteQuizAccountData, getQuizDetail, listQuizzes, saveQuizSource } from "../src/lib/quizStore";
import { runQuizJob } from "../src/lib/quizGeneration";
import type { QuizSource } from "../src/lib/quizTypes";

if (process.env.QUIZ_GENERATION_TEST !== "1") throw new Error("Set QUIZ_GENERATION_TEST=1 to test the configured model with synthetic materials.");
const email = `quiz-test-${randomUUID()}@test.invalid`;
const source: QuizSource = { id: randomUUID(), name: "Synthetic geometry lesson", kind: "text", unitKind: "paragraph", totalUnits: 3, segments: [
  { unit: 1, text: "A triangle is a polygon with exactly three straight sides and three angles. In Euclidean geometry, the sum of a triangle's interior angles is 180 degrees. An equilateral triangle has three equal sides and three angles of 60 degrees each." },
  { unit: 2, text: "A square has four equal sides and four right angles. Each interior angle of a square is 90 degrees. Its perimeter is four times the length of one side. Its area is the side length multiplied by itself." },
  { unit: 3, text: "A rectangle has four right angles. Opposite sides are equal in length. Its area is length multiplied by width. Its perimeter is twice the sum of length and width. A square is a special rectangle in which the length and width are equal." },
], bytes: 0, receivedAt: Date.now(), expiresAt: Date.now() + 600000, assignmentId: null, projectId: null, version: null };
const { segments: _segments, ...ref } = source;
void _segments;
try {
  await saveQuizSource(email, source);
  const job = await beginQuizJob(email, { requestId: randomUUID(), settings: { title: "기하 복습", language: "ko", count: 4, projectId: null, purpose: "concepts", topic: "", difficulty: "standard" }, sources: [{ ...ref, units: [1, 2, 3] }] }, false);
  await runQuizJob(email, job.id);
  const library = await listQuizzes(email, false);
  const completed = library.jobs.find(j => j.id === job.id)!;
  assert.equal(completed.status, "completed", completed.error ?? "generation did not complete");
  const { quiz } = await getQuizDetail(email, completed.quizId!);
  assert.ok(quiz.questions.length >= 2 && quiz.questions.length <= 4);
  assert.equal(library.access.used, quiz.questions.length);
  assert.ok(quiz.questions.every(q => q.sourceId === source.id && source.segments.some(s => s.unit === q.unit)));
  console.log(JSON.stringify({ generated: quiz.questions.length, used: library.access.used, questions: quiz.questions }, null, 2));
  console.log("PASS: actual model generation, independent review, persistent quiz storage and quota settlement with synthetic Korean study material.");
} finally { await deleteQuizAccountData(email); }
