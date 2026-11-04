import { Redis } from "@upstash/redis";
import { createHash } from "node:crypto";

export type AdminQuizMetrics = {
  generatedAt: string;
  coverage: "complete" | "partial";
  scannedAccounts: number;
  scannedRecords: number;
  totals: { users: number; quizzes: number; questions: number; attempts: number; completedAttempts: number; reviewAttempts: number };
  generation: { completed: number; failed: number; inProgress: number; interrupted: number };
};

type Reader = {
  scan: (cursor: string, options: { match: string; count: number }) => Promise<[string, string[]]>;
  hscan: (key: string, cursor: string, options: { match: string; count: number }) => Promise<[string, unknown[]]>;
};

const LIMITS = { commands: 200, accounts: 500, records: 10_000, durationMs: 8_000 };
const accountKey = /^rubricheck:quiz:\{[a-f0-9]{64}\}$/;

function object(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("QUIZ_METRICS_INVALID_RECORD");
  return parsed as Record<string, unknown>;
}

// Only the counters leave this module. SCAN/HSCAN avoid loading the entire quiz
// namespace or executing the mutation/sweep used by the user-facing library.
export async function collectAdminQuizMetrics(reader: Reader, options: { now?: number; limits?: Partial<typeof LIMITS> } = {}): Promise<AdminQuizMetrics> {
  const now = options.now ?? Date.now(), limits = { ...LIMITS, ...options.limits };
  const deadline = Date.now() + limits.durationMs;
  const report: AdminQuizMetrics = {
    generatedAt: new Date(now).toISOString(), coverage: "complete", scannedAccounts: 0, scannedRecords: 0,
    totals: { users: 0, quizzes: 0, questions: 0, attempts: 0, completedAttempts: 0, reviewAttempts: 0 },
    generation: { completed: 0, failed: 0, inProgress: 0, interrupted: 0 },
  };
  const accounts = new Set<string>();
  let commands = 0, stopped = false;
  function reserveCommand() {
    if (stopped || commands >= limits.commands || Date.now() >= deadline) { stopped = true; report.coverage = "partial"; return false; }
    commands++;
    return true;
  }
  function countRecord(field: string, raw: unknown) {
    const value = object(raw);
    if (field.startsWith("q:")) {
      if (!Array.isArray(value.questions)) throw new Error("QUIZ_METRICS_INVALID_RECORD");
      report.totals.quizzes++; report.totals.questions += value.questions.length;
    } else if (field.startsWith("t:")) {
      if (value.kind !== "full" && value.kind !== "review") throw new Error("QUIZ_METRICS_INVALID_RECORD");
      report.totals.attempts++;
      if (typeof value.completedAt === "number" && value.completedAt > 0) report.totals.completedAttempts++;
      if (value.kind === "review") report.totals.reviewAttempts++;
    } else {
      if (value.status === "completed") report.generation.completed++;
      else if (value.status === "failed") {
        if (value.error === "QUIZ_INTERRUPTED") report.generation.interrupted++;
        else report.generation.failed++;
      }
      else if (["queued", "generating", "validating"].includes(String(value.status))) {
        if (typeof value.leaseUntil !== "number") throw new Error("QUIZ_METRICS_INVALID_RECORD");
        if (value.leaseUntil <= now) report.generation.interrupted++;
        else report.generation.inProgress++;
      } else throw new Error("QUIZ_METRICS_INVALID_RECORD");
    }
  }
  async function readAccount(key: string) {
    let cursor = "0", countedUser = false;
    const fields = new Set<string>();
    let scanned = false;
    do {
      if (!reserveCommand()) return;
      const [next, entries] = await reader.hscan(key, cursor, { match: "[qjt]:*", count: 100 });
      if (!scanned) { report.scannedAccounts++; scanned = true; }
      if (entries.length % 2) throw new Error("QUIZ_METRICS_INVALID_RESPONSE");
      for (let index = 0; index < entries.length; index += 2) {
        const field = entries[index];
        if (typeof field !== "string" || !/^[qjt]:/.test(field) || fields.has(field)) continue;
        if (report.scannedRecords >= limits.records) { stopped = true; report.coverage = "partial"; return; }
        fields.add(field); countRecord(field, entries[index + 1]); report.scannedRecords++;
        if (!countedUser) { report.totals.users++; countedUser = true; }
      }
      cursor = String(next);
    } while (cursor !== "0");
  }
  let cursor = "0";
  do {
    if (!reserveCommand()) break;
    const [next, keys] = await reader.scan(cursor, { match: "rubricheck:quiz:{*}", count: 100 });
    let accountLimit = false;
    const fresh = keys.filter(key => {
      if (!accountKey.test(key) || accounts.has(key)) return false;
      if (accounts.size >= limits.accounts) { accountLimit = true; report.coverage = "partial"; return false; }
      accounts.add(key); return true;
    });
    for (let offset = 0; offset < fresh.length && !stopped; offset += 8) {
      await Promise.all(fresh.slice(offset, offset + 8).map(readAccount));
    }
    if (accountLimit) stopped = true;
    cursor = String(next);
  } while (cursor !== "0" && !stopped);
  return report;
}

// A short, process-local cache holds counters only and shares concurrent scans.
// The timestamp stays attached to the snapshot shown in the admin panel.
let cached: { key: string; expiresAt: number; value: Promise<AdminQuizMetrics> } | null = null;
export async function getAdminQuizMetrics(refresh = false): Promise<AdminQuizMetrics> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim(), token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("QUIZ_METRICS_UNAVAILABLE");
  const key = createHash("sha256").update(url).update("\0").update(token).digest("hex");
  if (!refresh && cached?.key === key && cached.expiresAt > Date.now()) return cached.value;
  const redis = new Redis({ url, token, signal: AbortSignal.timeout(10_000), retry: { retries: 0 } });
  const value = collectAdminQuizMetrics(redis);
  const entry = { key, expiresAt: Date.now() + 15_000, value };
  cached = entry;
  try { return await value; }
  catch (error) { if (cached === entry) cached = null; throw error; }
}
