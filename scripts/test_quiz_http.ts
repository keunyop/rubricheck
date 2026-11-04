// Opt-in test of the built local server, real Redis and the configured model.
// The server must use the same test session secret; no real user is impersonated.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../src/lib/creditSession";
import { deleteQuizAccountData, quizSourceKey } from "../src/lib/quizStore";
import { recoveryRedis } from "../src/lib/evaluationRecovery";
import type { QuizAttempt, QuizDetail, QuizJob, QuizLibrary, QuizSource } from "../src/lib/quizTypes";

if (process.env.QUIZ_HTTP_TEST !== "1") throw new Error("Set QUIZ_HTTP_TEST=1 to exercise the local HTTP server with synthetic data.");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3218";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
process.env.ENTITLEMENT_SESSION_SECRET = "local-quiz-browser-test-only";
const email = `quiz-http-${randomUUID()}@test.invalid`, other = `quiz-http-${randomUUID()}@test.invalid`;
const cookie = (owner: string) => CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: owner });
async function call<T>(path: string, body?: unknown, method = body ? "POST" : "GET", owner = email, expected = 200): Promise<T> {
  const response = await fetch(base + path, { method, headers: { cookie: cookie(owner), origin: base, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify(value));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return value as T;
}
try {
  const text = "A triangle has three straight sides. An equilateral triangle has three equal sides and three angles of 60 degrees. A square has four equal sides and four right angles.";
  // Two chunks cross the upload boundary; only paragraph 1 is selected.
  const bytes = Buffer.from(text + "\n\n" + "Synthetic excluded material. ".repeat(85_000));
  const upload = await call<{ uploadId: string; chunkBytes: number }>("/api/quizzes/sources", { action: "upload", name: "synthetic-notes.txt", size: bytes.length, range: "1" });
  assert.ok(bytes.length > upload.chunkBytes);
  for (let start = 0, index = 0; start < bytes.length; start += upload.chunkBytes, index++) {
    const response = await fetch(`${base}/api/quizzes/sources?id=${upload.uploadId}&index=${index}`, { method: "PUT", headers: { cookie: cookie(email), origin: base }, body: bytes.subarray(start, start + upload.chunkBytes) });
    assert.equal(response.status, 200, await response.text());
  }
  const { source } = await call<{ source: QuizSource }>("/api/quizzes/sources", { action: "extract", id: upload.uploadId });
  assert.deepEqual(source.segments, [{ unit: 1, text }]);
  assert.equal(source.totalUnits, 2);
  const payload = { requestId: randomUUID(), settings: { title: "HTTP geometry check", projectId: null, count: 2, language: "en", difficulty: "basic", purpose: "concepts", topic: "" }, sources: [{ id: source.id, units: [1] }] };
  const initial = await call<{ job: QuizJob }>("/api/quizzes", payload, "POST", email, 202);
  const deadline = Date.now() + 240_000;
  let library: QuizLibrary, job: QuizJob;
  do {
    await new Promise(resolve => setTimeout(resolve, 1500));
    library = await call<QuizLibrary>("/api/quizzes");
    job = library.jobs.find(j => j.id === initial.job.id)!;
    assert.notEqual(job.status, "failed", job.error ?? "generation failed");
    assert.ok(Date.now() < deadline, "HTTP generation timed out");
  } while (job.status !== "completed");
  const { quiz } = await call<QuizDetail>("/api/quizzes?id=" + job.quizId);
  assert.ok(quiz.questions.length >= 1 && quiz.questions.length <= 2);
  assert.equal(library.access.used, quiz.questions.length);
  let { attempt } = await call<{ attempt: QuizAttempt }>("/api/quizzes/attempts", { action: "start", id: randomUUID(), quizId: quiz.id, kind: "full" });
  for (const q of quiz.questions) {
    ({ attempt } = await call<{ attempt: QuizAttempt }>("/api/quizzes/attempts", { action: "answer", id: attempt.id, quizId: quiz.id, revision: attempt.revision, questionId: q.id, answer: q.answer }));
  }
  await call("/api/quizzes/attempts", { action: "answer", id: attempt.id, quizId: quiz.id, revision: attempt.revision, finish: true });
  await recoveryRedis().set(quizSourceKey(email, source.id), { ...source, expiresAt: Date.now() - 1 }, { ex: 30 });
  await call("/api/quizzes/sources?id=" + source.id, undefined, "GET", email, 410);
  await call("/api/quizzes?id=" + quiz.id, undefined, "GET", other, 404);
  const replay = await call<{ job: QuizJob }>("/api/quizzes", payload);
  assert.equal(replay.job.quizId, quiz.id);
  const final = await call<QuizLibrary>("/api/quizzes");
  assert.equal(final.quizzes[0].latestFull?.correct, quiz.questions.length);
  assert.equal(final.access.used, quiz.questions.length);
  await call("/api/quizzes", { action: "delete", quizId: quiz.id }, "PATCH");
  assert.equal((await call<QuizLibrary>("/api/quizzes")).access.used, quiz.questions.length);
  console.log(`PASS: live HTTP chunk upload, scoped extraction, after-response generation (${quiz.questions.length} questions), atomic usage, practice, expiry, idempotent replay and owner isolation.`);
} finally { await deleteQuizAccountData(email); await deleteQuizAccountData(other); }
