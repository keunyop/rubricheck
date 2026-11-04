// Integration test against configured Redis. Only fresh, synthetic account
// namespaces are touched and removed; no real account keys are read or written.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beginQuizJob, claimQuizJob, deleteQuizAccountData, getQuizDetail, getQuizSource, listQuizzes, quizKey, quizSourceKey, quizTransaction, saveQuizSource } from "../src/lib/quizStore";
import { recoveryRedis } from "../src/lib/evaluationRecovery";
import { createProject, editWorkspace, workspaceKey } from "../src/lib/assignmentWorkspace";
import { scoreAttempt, type Quiz, type QuizAttempt, type QuizJob, type QuizSettings, type QuizSource } from "../src/lib/quizTypes";

if (process.env.QUIZ_REDIS_TEST !== "1") throw new Error("Set QUIZ_REDIS_TEST=1 to run the isolated Redis integration test.");
const email = `quiz-test-${randomUUID()}@test.invalid`, other = `quiz-test-${randomUUID()}@test.invalid`;
const redis = recoveryRedis();
const source: QuizSource = { id: randomUUID(), name: "Synthetic geometry", kind: "text", unitKind: "paragraph", totalUnits: 1, segments: [{ unit: 1, text: "A triangle has three sides. A square has four equal sides." }], bytes: 0, receivedAt: Date.now(), expiresAt: Date.now() + 60000, assignmentId: null, projectId: null, version: null };
const { segments, ...metadata } = source;
const sources = [{ ...metadata, units: [1] }];
const settings: QuizSettings = { title: "Synthetic quiz", count: 4, projectId: null, purpose: "concepts", topic: "", difficulty: "standard", language: "en" };
const newInput = (count = 4) => ({ requestId: randomUUID(), settings: { ...settings, count }, sources });
function quiz(count: number): Quiz {
  return { id: randomUUID(), title: settings.title, projectId: null, settings: { ...settings, count }, createdAt: Date.now(), sources, requestedCount: count, questions: Array.from({ length: count }, (_, i) => ({ id: String(i + 1), type: "mcq", question: `Synthetic question ${i + 1}`, options: ["Three", "Four", "Five", "Six"], answer: 0, explanation: "A triangle has three sides.", concepts: ["Triangle"], sourceId: source.id, unit: 1 })) };
}
async function complete(input: ReturnType<typeof newInput>, pro: boolean, count: number) {
  await beginQuizJob(email, input, pro);
  const claimed = (await claimQuizJob(email, input.requestId))!;
  const result = quiz(count);
  const job = await quizTransaction<QuizJob>(email, "finish", { id: claimed.id, token: claimed.token, quiz: result });
  assert.equal(job.status, "completed");
  return { result, claimed };
}
try {
  await saveQuizSource(email, source);
  assert.equal((await getQuizSource(email, source.id)).segments[0].text, segments[0].text);
  await assert.rejects(getQuizSource(other, source.id), /QUIZ_SOURCE_EXPIRED/);
  const parallel = await Promise.allSettled(Array.from({ length: 12 }, () => beginQuizJob(email, newInput(), false)));
  const accepted = parallel.filter(r => r.status === "fulfilled");
  assert.equal(accepted.length, 1, "only one simultaneous job per account");
  const job = (accepted[0] as PromiseFulfilledResult<QuizJob>).value;
  assert.equal((await listQuizzes(email, false)).access.remaining, 6);
  assert.equal((await beginQuizJob(email, { requestId: job.id, settings, sources }, false)).id, job.id);
  await assert.rejects(beginQuizJob(email, { requestId: job.id, settings: { ...settings, title: "Different" }, sources }, false), /QUIZ_REQUEST_CONFLICT/);
  const claimed = (await claimQuizJob(email, job.id))!;
  assert.equal(await claimQuizJob(email, job.id), null, "single worker owns the lease");
  await quizTransaction(email, "fail", { id: job.id, token: claimed.token, error: "QUIZ_GENERATION_FAILED" });
  assert.equal((await listQuizzes(email, false)).access.remaining, 10);
  const partial = await complete(newInput(4), false, 2);
  await Promise.all(Array.from({ length: 8 }, () => quizTransaction(email, "finish", { id: partial.claimed.id, token: partial.claimed.token, quiz: quiz(2) })));
  assert.equal((await listQuizzes(email, false)).access.used, 2);
  assert.equal((await listQuizzes(email, false)).quizzes.length, 1, "duplicate completions do not create quizzes");
  await quizTransaction(email, "delete", { quizId: partial.result.id });
  assert.equal((await listQuizzes(email, false)).access.used, 2, "deletion never restores quota");
  const pro = await complete(newInput(20), true, 20);
  assert.equal((await listQuizzes(email, false)).access.used, 2, "Pro generation does not spend the free trial");
  await assert.rejects(beginQuizJob(email, newInput(10), false), /QUIZ_LIMIT_REACHED/);
  const full = await complete(newInput(4), false, 4);
  const project = await createProject(email, "Synthetic project");
  await quizTransaction(email, "edit", { quizId: full.result.id, projectId: project.id });
  await editWorkspace(email, "deleteProject", project.id, null);
  assert.equal((await getQuizDetail(email, full.result.id)).quiz.projectId, null);
  await assert.rejects(getQuizDetail(other, full.result.id), /QUIZ_NOT_FOUND/);
  await assert.rejects(quizTransaction(other, "delete", { quizId: full.result.id }), /QUIZ_NOT_FOUND/);
  let attempt = await quizTransaction<QuizAttempt>(email, "start", { id: randomUUID(), quizId: full.result.id, kind: "full", restart: false });
  const duplicate = await quizTransaction<QuizAttempt>(email, "start", { id: randomUUID(), quizId: full.result.id, kind: "full", restart: false });
  assert.equal(duplicate.id, attempt.id);
  attempt = await quizTransaction(email, "answer", { id: attempt.id, quizId: full.result.id, revision: 0, questionId: "1", answer: 1, position: 1 });
  await assert.rejects(quizTransaction(email, "answer", { id: attempt.id, quizId: full.result.id, revision: 0, questionId: "2", answer: 0 }), /QUIZ_ATTEMPT_CONFLICT/);
  await assert.rejects(quizTransaction(email, "answer", { id: attempt.id, quizId: full.result.id, revision: attempt.revision, questionId: "1", answer: 0 }), /QUIZ_ANSWER_LOCKED/);
  attempt = await quizTransaction(email, "answer", { id: attempt.id, quizId: full.result.id, revision: attempt.revision, questionId: "2", answer: 0, finish: true });
  assert.deepEqual(scoreAttempt(full.result, attempt), { correct: 1, total: 4, wrong: 1, unanswered: 2, percent: 25 });
  let review = await quizTransaction<QuizAttempt>(email, "start", { id: randomUUID(), quizId: full.result.id, kind: "review", fromAttempt: attempt.id, restart: false });
  assert.deepEqual(review.questionIds, ["1", "3", "4"]);
  for (const questionId of review.questionIds) review = await quizTransaction(email, "answer", { id: review.id, quizId: full.result.id, revision: review.revision, questionId, answer: 0 });
  review = await quizTransaction(email, "answer", { id: review.id, quizId: full.result.id, revision: review.revision, finish: true });
  assert.equal(scoreAttempt(full.result, review).percent, 100);
  const summary = (await listQuizzes(email, false)).quizzes.find(q => q.id === full.result.id)!;
  assert.equal(summary.latestFull?.correct, 1);
  assert.equal((await listQuizzes(email, false)).access.used, 6, "practice never consumes quota");
  await redis.set(quizSourceKey(email, source.id), { ...source, expiresAt: Date.now() - 1 }, { ex: 10 });
  await assert.rejects(getQuizSource(email, source.id), /QUIZ_SOURCE_EXPIRED/);
  assert.equal((await getQuizDetail(email, pro.result.id)).quiz.questions.length, 20, "stored quizzes outlive sources and Pro");
  const stale = await beginQuizJob(email, newInput(4), false);
  const oldClaim = (await claimQuizJob(email, stale.id))!;
  await redis.hset(quizKey(email), { ["j:" + stale.id]: { ...oldClaim, leaseUntil: Date.now() - 1 } });
  const last = await complete(newInput(4), false, 4);
  const oldCompletion = await quizTransaction<QuizJob>(email, "finish", { id: stale.id, token: oldClaim.token, quiz: quiz(4) });
  assert.equal(oldCompletion.status, "failed");
  assert.equal((await listQuizzes(email, false)).access.used, 10);
  await assert.rejects(beginQuizJob(email, newInput(1), false), /QUIZ_LIMIT_REACHED/);
  await quizTransaction(email, "delete", { quizId: full.result.id });
  await assert.rejects(getQuizDetail(email, full.result.id), /QUIZ_NOT_FOUND/);
  assert.equal((await getQuizDetail(email, last.result.id)).quiz.questions.length, 4);
  console.log("PASS: Redis concurrency, atomic quota settlement, idempotency, leases, immutable answers, full/review attempts, project deletion, source expiry and owner isolation.");
} finally {
  await deleteQuizAccountData(email);
  await deleteQuizAccountData(other);
  await redis.del(workspaceKey(email), workspaceKey(other));
}
