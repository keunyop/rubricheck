import { Redis } from "@upstash/redis";
import type { QuizQuestion, QuizSourceRef } from "./quizTypes";

export type AdminQuizListItem = {
  ownerId: string;
  id: string;
  title: string;
  createdAt: number;
  questionCount: number;
  language: string;
  difficulty: string;
  purpose: string;
  sourceNames: string[];
};

export type AdminQuizList = {
  generatedAt: string;
  coverage: "complete" | "partial";
  scannedAccounts: number;
  scannedQuizzes: number;
  total: number;
  offset: number;
  limit: number;
  items: AdminQuizListItem[];
};

export type AdminQuizDetail = AdminQuizListItem & {
  requestedCount: number;
  topic: string;
  sources: Array<{ id: string; name: string; kind: string; unitKind: string; units: number[] }>;
  questions: Array<QuizQuestion & { sourceName: string }>;
};

type ListReader = {
  scan: (cursor: string, options: { match: string; count: number }) => Promise<[string, string[]]>;
  hscan: (key: string, cursor: string, options: { match: string; count: number }) => Promise<[string, unknown[]]>;
};

type DetailReader = {
  hget: (key: string, field: string) => Promise<unknown>;
};

const DEFAULT_LIMITS = { commands: 250, accounts: 500, quizzes: 10_000, durationMs: 8_000 };
const accountKey = /^rubricheck:quiz:\{([a-f0-9]{64})\}$/;
const ownerIdPattern = /^[a-f0-9]{64}$/;
const quizIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function string(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sources(value: unknown): QuizSourceRef[] {
  return Array.isArray(value) ? value.filter(source => source && typeof source === "object") as QuizSourceRef[] : [];
}

function questions(value: unknown): QuizQuestion[] {
  return Array.isArray(value) ? value.filter(question => question && typeof question === "object") as QuizQuestion[] : [];
}

function normalizeQuestion(value: unknown): QuizQuestion | null {
  const question = record(value);
  if (!question) return null;
  const options = Array.isArray(question.options) ? question.options.filter(option => typeof option === "string") : [];
  const answer = typeof question.answer === "number" && Number.isInteger(question.answer) ? question.answer : -1;
  const type = question.type === "true_false" ? "true_false" : question.type === "mcq" ? "mcq" : null;
  if (!type || !string(question.id) || !string(question.question) || options.length < 2 || answer < 0 || answer >= options.length) return null;
  return {
    id: string(question.id),
    type,
    question: string(question.question),
    options,
    answer,
    explanation: string(question.explanation),
    concepts: Array.isArray(question.concepts) ? question.concepts.filter(concept => typeof concept === "string") : [],
    sourceId: string(question.sourceId),
    unit: typeof question.unit === "number" && Number.isFinite(question.unit) ? question.unit : 0,
  };
}

function summarize(ownerId: string, field: string, value: unknown): AdminQuizListItem | null {
  const quiz = record(value);
  if (!quiz) return null;
  const id = string(quiz.id, field.slice(2));
  const title = string(quiz.title);
  const createdAt = typeof quiz.createdAt === "number" && Number.isFinite(quiz.createdAt) ? quiz.createdAt : 0;
  const settings = record(quiz.settings) ?? {};
  const quizQuestions = questions(quiz.questions);
  if (!quizIdPattern.test(id) || !title || !createdAt || !quizQuestions.length) return null;
  return {
    ownerId,
    id,
    title,
    createdAt,
    questionCount: quizQuestions.length,
    language: string(settings.language, "-"),
    difficulty: string(settings.difficulty, "-"),
    purpose: string(settings.purpose, "-"),
    sourceNames: sources(quiz.sources).map(source => string(source.name)).filter(Boolean),
  };
}

export async function collectAdminQuizList(
  reader: ListReader,
  options: { query?: string; offset?: number; limit?: number; limits?: Partial<typeof DEFAULT_LIMITS>; now?: number } = {},
): Promise<AdminQuizList> {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const query = options.query?.trim().toLocaleLowerCase() ?? "";
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 25)));
  const deadline = Date.now() + limits.durationMs;
  const items: AdminQuizListItem[] = [];
  const accounts = new Set<string>();
  let commands = 0;
  let scannedAccounts = 0;
  let scannedQuizzes = 0;
  let coverage: AdminQuizList["coverage"] = "complete";

  const reserve = () => {
    if (commands >= limits.commands || Date.now() >= deadline) {
      coverage = "partial";
      return false;
    }
    commands++;
    return true;
  };
  const isPartial = () => coverage === "partial";

  async function readAccount(key: string, ownerId: string) {
    let cursor = "0";
    const fields = new Set<string>();
    scannedAccounts++;
    do {
      if (!reserve()) return;
      const [next, entries] = await reader.hscan(key, cursor, { match: "q:*", count: 100 });
      if (entries.length % 2) throw new Error("QUIZ_LIST_INVALID_RESPONSE");
      for (let index = 0; index < entries.length; index += 2) {
        if (scannedQuizzes >= limits.quizzes) {
          coverage = "partial";
          return;
        }
        const field = entries[index];
        if (typeof field !== "string" || !field.startsWith("q:") || fields.has(field)) continue;
        fields.add(field);
        scannedQuizzes++;
        const item = summarize(ownerId, field, entries[index + 1]);
        if (!item) continue;
        const searchable = `${item.title} ${item.sourceNames.join(" ")}`.toLocaleLowerCase();
        if (!query || searchable.includes(query)) items.push(item);
      }
      cursor = String(next);
    } while (cursor !== "0" && !isPartial());
  }

  let cursor = "0";
  do {
    if (!reserve()) break;
    const [next, keys] = await reader.scan(cursor, { match: "rubricheck:quiz:{*}", count: 100 });
    for (const key of keys) {
      const match = accountKey.exec(key);
      if (!match || accounts.has(key)) continue;
      if (accounts.size >= limits.accounts) {
        coverage = "partial";
        break;
      }
      accounts.add(key);
      await readAccount(key, match[1]);
      if (isPartial()) break;
    }
    cursor = String(next);
  } while (cursor !== "0" && !isPartial());

  items.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  return {
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    coverage,
    scannedAccounts,
    scannedQuizzes,
    total: items.length,
    offset,
    limit,
    items: items.slice(offset, offset + limit),
  };
}

export async function readAdminQuizDetail(reader: DetailReader, ownerId: string, id: string): Promise<AdminQuizDetail | null> {
  if (!ownerIdPattern.test(ownerId) || !quizIdPattern.test(id)) return null;
  const raw = await reader.hget(`rubricheck:quiz:{${ownerId}}`, `q:${id}`);
  const summary = summarize(ownerId, `q:${id}`, raw);
  const quiz = record(raw);
  if (!summary || !quiz) return null;
  const quizSources = sources(quiz.sources);
  const sourceNames = new Map(quizSources.map(source => [source.id, source.name]));
  const settings = record(quiz.settings) ?? {};
  return {
    ...summary,
    requestedCount: typeof quiz.requestedCount === "number" ? quiz.requestedCount : summary.questionCount,
    topic: string(settings.topic),
    sources: quizSources.map(source => ({
      id: string(source.id),
      name: string(source.name),
      kind: string(source.kind),
      unitKind: string(source.unitKind),
      units: Array.isArray(source.units) ? source.units.filter(unit => Number.isInteger(unit)) : [],
    })),
    questions: (Array.isArray(quiz.questions) ? quiz.questions : []).map(normalizeQuestion).filter((question): question is QuizQuestion => Boolean(question)).map(question => ({ ...question, sourceName: sourceNames.get(question.sourceId) ?? "Unknown source" })),
  };
}

function adminRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("QUIZ_LIST_UNAVAILABLE");
  return new Redis({ url, token, signal: AbortSignal.timeout(10_000), retry: { retries: 0 } });
}

export function getAdminQuizList(options: { query?: string; offset?: number; limit?: number }) {
  return collectAdminQuizList(adminRedis(), options);
}

export function getAdminQuizDetail(ownerId: string, id: string) {
  return readAdminQuizDetail(adminRedis(), ownerId, id);
}
