import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { selectQuizSources, validateQuizQuestions, parseUnitRange, persistedQuestions } from "./quizValidation.ts";
import { scoreAttempt, summarizeQuiz, safeQuizReturn, quizGenerationSchema, type QuizSource, type Quiz, type QuizAttempt } from "./quizTypes.ts";
import { LOCALES } from "../i18n/config.ts";
import { quizMessages } from "../i18n/quiz.ts";
import { translate } from "../i18n/translate.ts";

const source: QuizSource = { id: randomUUID(), name: "Geometry notes", kind: "text", unitKind: "paragraph", totalUnits: 2, segments: [{ unit: 1, text: "A triangle has three sides and its interior angles add to 180 degrees." }, { unit: 2, text: "A square has four equal sides and four right angles." }], bytes: 0, receivedAt: 0, expiresAt: Date.now() + 100000, assignmentId: null, version: null, projectId: null };
const q = { type: "mcq", question: "How many sides does a triangle have?", options: ["Three", "Four", "Five", "Six"], answer: 0, explanation: "A triangle has three sides. Four describes a quadrilateral.", concepts: ["Triangles"], sourceId: source.id, unit: 1, evidence: "A triangle has three sides" };

test("quiz sources enforce scope, aggregate limits, expiry and one assignment version", () => {
  const result = selectQuizSources([source], [{ id: source.id, units: [2] }]);
  assert.deepEqual(result.sources[0].segments.map(s => s.unit), [2]);
  assert.equal("segments" in result.refs[0], false);
  assert.equal("feedback" in result.refs[0], false);
  assert.throws(() => selectQuizSources([source], [{ id: source.id, units: [1, 1] }]), /QUIZ_INVALID_RANGE/);
  assert.throws(() => selectQuizSources([source], [{ id: source.id, units: [3] }]), /QUIZ_INVALID_RANGE/);
  assert.throws(() => selectQuizSources([source], [{ id: source.id, units: [1] }], source.expiresAt), /QUIZ_SOURCE_EXPIRED/);
  const huge = { ...source, segments: [{ unit: 1, text: "a".repeat(50001) }] };
  assert.throws(() => selectQuizSources([huge], [{ id: source.id, units: [1] }]), /QUIZ_SOURCE_LIMIT/);
  const extra = { ...source, id: randomUUID(), kind: "assignment" as const };
  assert.throws(() => selectQuizSources([{ ...source, kind: "assignment" }, extra], [{ id: source.id, units: [1] }, { id: extra.id, units: [1] }]), /QUIZ_INVALID_SOURCES/);
  assert.deepEqual(parseUnitRange("3, 1-2, 2"), [1, 2, 3]);
  for (const range of ["0", "5-3", "1.5", "1-99999", "1,,2"]) assert.throws(() => parseUnitRange(range));
});

test("question validation drops duplicates, invented citations, invalid choices and unsupported types", () => {
  const tf = { ...q, type: "true_false", question: "A square has four equal sides.", options: ["O", "X"], answer: 0, unit: 2, evidence: "A square has four equal sides" };
  const questions = [q, { ...q }, { ...q, question: "An invented citation should be dropped", unit: 99 }, { ...q, question: "Unrelated content should be dropped", evidence: "A triangle has nine equal sides" }, { ...q, question: "A question with duplicate options", options: ["Three", "three", "Five", "Six"] }, { ...q, type: "essay" }, { ...tf, question: "Invalid boolean labels", options: ["Yes", "No"] }, tf];
  const valid = validateQuizQuestions({ questions }, [source], 10);
  assert.equal(valid.length, 2);
  assert.equal(validateQuizQuestions({ questions: [q, tf] }, [source], 1).length, 1);
  assert.equal(validateQuizQuestions({ questions: [q] }, [{ ...source, segments: [source.segments[1]] }], 10).length, 0);
  assert.ok(persistedQuestions(valid).every(q => !("evidence" in q)));
});

test("review attempts keep the latest full score independent and count unanswered as incorrect", () => {
  const questions = persistedQuestions(validateQuizQuestions({ questions: [q] }, [source], 10));
  const quiz: Quiz = { id: randomUUID(), title: "Test", projectId: null, createdAt: 1, settings: { title: "Test", projectId: null, language: "en", difficulty: "standard", count: 1, purpose: "concepts", topic: "" }, sources: [], questions, requestedCount: 1 };
  const full: QuizAttempt = { id: randomUUID(), quizId: quiz.id, kind: "full", questionIds: ["1"], answers: {}, position: 0, startedAt: 1, updatedAt: 2, completedAt: 2, revision: 1 };
  const review = { ...full, id: randomUUID(), kind: "review" as const, answers: { "1": 0 }, updatedAt: 4, completedAt: 4 };
  assert.deepEqual(scoreAttempt(quiz, full), { correct: 0, total: 1, wrong: 0, unanswered: 1, percent: 0 });
  assert.equal(scoreAttempt(quiz, review).percent, 100);
  assert.equal(summarizeQuiz(quiz, [full, review]).latestFull?.correct, 0);
  assert.equal(summarizeQuiz(quiz, [{ ...review, completedAt: null }, full]).state, "active");
});

test("all quiz copy has all supported locales and matching interpolation fields", () => {
  for (const [key, translations] of Object.entries(quizMessages)) {
    const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(m => m[0]).sort();
    assert.equal(translations.length, LOCALES.length - 1, key);
    for (const locale of LOCALES.filter(l => l !== "en")) {
      const translated = translate(locale, key);
      assert.notEqual(translated, key, locale + ": " + key);
      assert.deepEqual(placeholders(translated), placeholders(key), locale + ": " + key);
    }
  }
});

test("quiz redirects stay local and request validation includes all seven languages", () => {
  assert.equal(safeQuizReturn("/ko/quizzes?view=create&assignment=123"), "/ko/quizzes?view=create&assignment=123");
  for (const path of ["https://evil.invalid", "//evil.invalid", "/quizzes/../admin", "/quizzes\\evil", "/admin", "/quizzes\n"]) assert.equal(safeQuizReturn(path), null);
  for (const language of LOCALES) assert.ok(quizGenerationSchema.safeParse({ requestId: randomUUID(), sources: [{ id: source.id, units: [1] }], settings: { title: "test", projectId: null, count: 1, language, difficulty: "standard", purpose: "concepts" } }).success);
});
