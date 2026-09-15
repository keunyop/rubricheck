import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { Rubric, GradingMode } from "../../lib/schema";
import { restrictEvaluationFeedback, type FinalEvaluation } from "../../lib/gradeFinalization";
import type { HiddenAiDocumentAlert } from "../../lib/hiddenAiAlert";

export type RecoverableResult = FinalEvaluation & { evaluation_id: string; hidden_ai_alert?: HiddenAiDocumentAlert };
export type EvaluationRecord = {
  owner: string; rubric: Rubric; assignmentText: string; mode: GradingMode;
  result: RecoverableResult; expiresAt: number;
};
export const RECOVERY_TTL_SECONDS = 86400;
export function recoveryRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("RECOVERY_STORE_UNAVAILABLE");
  return new Redis({ url, token });
}
export function ownerHash(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
export function normalizeEvaluationId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
export function recoveryKey(id: string) { return "rubricheck:evaluation:" + id; }
export async function saveEvaluation(input: {
  email: string; rubric: Rubric; assignmentText: string; mode: GradingMode;
  result: FinalEvaluation & { hidden_ai_alert?: HiddenAiDocumentAlert };
}): Promise<RecoverableResult> {
  const id = randomUUID();
  const result = { ...input.result, evaluation_id: id };
  const record: EvaluationRecord = {
    owner: ownerHash(input.email), rubric: input.rubric, assignmentText: input.assignmentText,
    mode: input.mode, result, expiresAt: Date.now() + RECOVERY_TTL_SECONDS * 1000,
  };
  await recoveryRedis().set(recoveryKey(id), record, { ex: RECOVERY_TTL_SECONDS });
  return result;
}
export async function getEvaluation(id: string, email: string): Promise<EvaluationRecord | null> {
  if (!normalizeEvaluationId(id)) return null;
  const record = await recoveryRedis().get<EvaluationRecord>(recoveryKey(id));
  return record && record.owner === ownerHash(email) && record.expiresAt > Date.now()
    ? { ...record, result: restrictEvaluationFeedback(record.result) } : null;
}
export async function upgradeEvaluation(id: string, email: string, generate: (record: EvaluationRecord) => Promise<RecoverableResult>) {
  const redis = recoveryRedis();
  const record = await getEvaluation(id, email);
  if (!record) throw new Error("EVALUATION_EXPIRED");
  if (record.result.access_tier !== "free") return record.result;
  const key = recoveryKey(id);
  const lock = key + ":upgrade";
  const token = randomUUID();
  if (!await redis.set(lock, token, { nx: true, ex: 600 })) throw new Error("UPGRADE_PENDING");
  try {
    const latest = await getEvaluation(id, email);
    if (!latest) throw new Error("EVALUATION_EXPIRED");
    if (latest.result.access_tier !== "free") return latest.result;
    const result = await generate(latest);
    const ttl = Math.floor((latest.expiresAt - Date.now()) / 1000);
    if (ttl <= 0) throw new Error("EVALUATION_EXPIRED");
    const saved = await redis.eval<unknown[], number>(
      "if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('set',KEYS[2],ARGV[2],'EX',ARGV[3]) return 1",
      [lock, key], [token, JSON.stringify({ ...latest, result }), ttl],
    );
    if (!saved) throw new Error("UPGRADE_PENDING");
    return result;
  } finally {
    await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) end return 0", [lock], [token]);
  }
}
