import { z } from "zod";
import { LOCALES, type Locale } from "../i18n/config";

export const QUIZ_LIMITS = { free: 10, questions: 20, sources: 5, fileBytes: 20 * 1024 * 1024, totalBytes: 50 * 1024 * 1024, units: 50, characters: 50_000, retentionSeconds: 86400, leaseMs: 300_000 } as const;
export const quizId = z.string().uuid();
export const sourceSelectionSchema = z.object({ id: quizId, units: z.array(z.number().int().positive()).min(1).max(5000) });
export const quizSettingsSchema = z.object({
  title: z.string().trim().min(1).max(120), projectId: quizId.nullable(),
  count: z.number().int().min(1).max(QUIZ_LIMITS.questions), language: z.enum(LOCALES),
  difficulty: z.enum(["basic", "standard", "advanced"]), purpose: z.enum(["concepts", "improvements", "topic"]),
  topic: z.string().trim().max(300).default(""),
});
export const quizGenerationSchema = z.object({ requestId: quizId, sources: z.array(sourceSelectionSchema).min(1).max(QUIZ_LIMITS.sources), settings: quizSettingsSchema });
export type QuizSettings = z.infer<typeof quizSettingsSchema>;
export type SourceSelection = z.infer<typeof sourceSelectionSchema>;
export type QuizSegment = { unit: number; text: string };
export type QuizSource = {
  id: string; name: string; kind: "assignment" | "pdf" | "docx" | "pptx" | "txt" | "image" | "text";
  unitKind: "page" | "slide" | "paragraph" | "image"; totalUnits: number; segments: QuizSegment[];
  bytes: number; receivedAt: number; expiresAt: number; assignmentId: string | null; version: number | null;
  projectId: string | null; feedback?: string[];
};
export type QuizSourceRef = Omit<QuizSource, "segments" | "feedback"> & { units: number[] };
export type QuizQuestion = {
  id: string; type: "mcq" | "true_false"; question: string; options: string[]; answer: number;
  explanation: string; concepts: string[]; sourceId: string; unit: number;
};
export type Quiz = {
  id: string; title: string; projectId: string | null; createdAt: number; settings: QuizSettings;
  sources: QuizSourceRef[]; questions: QuizQuestion[]; requestedCount: number;
};
export type QuizJob = {
  id: string; fingerprint: string; settings: QuizSettings; sources: QuizSourceRef[];
  status: "queued" | "generating" | "validating" | "completed" | "failed";
  pro: boolean; reserved: number; createdAt: number; leaseUntil: number;
  quizId: string | null; generatedCount: number; error: string | null; token?: string;
};
export type QuizAttempt = {
  id: string; quizId: string; kind: "full" | "review"; questionIds: string[];
  answers: Record<string, number>; position: number; startedAt: number; updatedAt: number;
  completedAt: number | null; revision: number;
};
export type QuizSummary = Omit<Quiz, "questions"> & { questionCount: number; types: { mcq: number; true_false: number }; state: "unstarted" | "active" | "completed"; progress: number; lastStudied: number; latestFull: { correct: number; total: number } | null };
export type QuizAccess = { pro: boolean; used: number; reserved: number; remaining: number };
export type QuizLibrary = { quizzes: QuizSummary[]; jobs: QuizJob[]; access: QuizAccess };
export type QuizDetail = { quiz: Quiz; attempts: QuizAttempt[] };

export function scoreAttempt(quiz: Quiz, attempt: QuizAttempt) {
  const questions = quiz.questions.filter(q => attempt.questionIds.includes(q.id));
  const correct = questions.filter(q => attempt.answers[q.id] === q.answer).length;
  const unanswered = questions.filter(q => attempt.answers[q.id] === undefined).length;
  return { correct, total: questions.length, unanswered, wrong: questions.length - correct - unanswered, percent: questions.length ? Math.round(correct / questions.length * 100) : 0 };
}

export function summarizeQuiz(quiz: Quiz, attempts: QuizAttempt[]): QuizSummary {
  const ordered = attempts.filter(a => a.quizId === quiz.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const active = ordered.find(a => a.completedAt === null);
  const latestFull = ordered.find(a => a.kind === "full" && a.completedAt !== null);
  const { questions, ...rest } = quiz;
  return { ...rest, questionCount: questions.length, types: { mcq: questions.filter(q => q.type === "mcq").length, true_false: questions.filter(q => q.type === "true_false").length }, state: active ? "active" : ordered.length ? "completed" : "unstarted", progress: active ? Object.keys(active.answers).length : 0, lastStudied: ordered[0]?.updatedAt ?? 0, latestFull: latestFull ? scoreAttempt(quiz, latestFull) : null };
}

export function quizLoginPath(destination: string, locale: Locale) {
  const prefix = locale === "en" ? "" : "/" + locale;
  return `${prefix}/workspace?start=login&returnTo=${encodeURIComponent(destination)}`;
}

export function safeQuizReturn(value: string | null): string | null {
  return value && /^\/(?:ko\/|ms\/|hi\/|ur\/|vi\/|zh\/)?quizzes(?:\?(?:[^#\\\r\n]*))?$/.test(value) ? value : null;
}
