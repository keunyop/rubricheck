import { createHash, randomBytes, randomUUID } from "node:crypto";
import { evaluationProvenance } from "./evaluationProvenance";
import type { NextResponse } from "next/server";
import type { FinalEvaluation } from "../../lib/gradeFinalization";
import type { Rubric } from "../../lib/schema";
import { getRequestIp } from "./freeUsageActor";
import { recoveryRedis, recoveryKey, ownerHash, RECOVERY_TTL_SECONDS, type EvaluationRecord } from "./evaluationRecovery";

export const TRIAL_COOKIE = "rubricheck_guest_trial";
const LIMIT_TTL = 365 * 86400;
const LOCK_TTL = 600;
const NETWORK_TTL = 86400;
export const TRIAL_TEXT_LIMIT = 20000;
import type { TrialPreview } from "./trialPreview";
type TrialRecord = Omit<EvaluationRecord, "owner"> & { owner: string | null };
export type TrialIdentity = { token: string; keys: string[] };
export type TrialReservation = TrialIdentity & { lease: string };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const recordKey = (token: string) => "rubricheck:trial:result:" + hash(token);
export function trialIdentity(request: Request): TrialIdentity {
  const cookie = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(TRIAL_COOKIE + "="))?.slice(TRIAL_COOKIE.length + 1);
  const token = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : randomBytes(32).toString("hex");
  return { token, keys: ["rubricheck:trial:browser:" + hash(token), "rubricheck:trial:ip:" + hash(getRequestIp(request))] };
}
export function setTrialCookie(response: NextResponse, identity: TrialIdentity) {
  response.cookies.set(TRIAL_COOKIE, identity.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: LIMIT_TTL });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export function trialPreview(result: FinalEvaluation): TrialPreview {
  // Explicit allowlist: never ship criteria, evidence or revision advice to guests.
  return { guest_preview: true, title: result.title, overall_range: result.overall_range, summary: result.summary, ...(result.grading_basis === "general" ? { grading_basis: "general" as const } : {}) };
}
export async function readTrial(identity: TrialIdentity) {
  const redis = recoveryRedis();
  const [record, browser, ip] = await Promise.all([
    redis.get<TrialRecord>(recordKey(identity.token)),
    redis.get<string>(identity.keys[0]), redis.get<string>(identity.keys[1]),
  ]);
  return { used: browser === "used" || ip === "used", pending: Boolean((browser && browser !== "used") || (ip && ip !== "used")),
    result: record && !record.owner && record.expiresAt > Date.now() ? trialPreview(record.result) : null };
}
export async function reserveTrial(identity: TrialIdentity): Promise<TrialReservation> {
  const lease = randomUUID();
  let status: number;
  try {
    status = await recoveryRedis().eval<unknown[], number>(
    `local a = redis.call('GET', KEYS[1]); local b = redis.call('GET', KEYS[2])
    if a == 'used' or b == 'used' then return 0 end
    if a == ARGV[1] and b == ARGV[1] then return 1 end
    if a or b then return -1 end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2]); return 1`, identity.keys, [lease, LOCK_TTL]);
  } catch (error) {
    // A dropped reservation response may still have acquired the lease.
    try { await releaseTrial({ ...identity, lease }); } catch {}
    throw error;
  }
  if (status !== 1) throw new Error(status === 0 ? "TRIAL_LIMIT_REACHED" : "TRIAL_PENDING");
  return { ...identity, lease };
}
export async function releaseTrial(reservation: TrialReservation) {
  await recoveryRedis().eval(
    `for i = 1, 2 do if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]) end end return 1`,
    reservation.keys, [reservation.lease]);
}
export async function completeTrial(reservation: TrialReservation, input: { rubric: Rubric; assignmentText: string; result: FinalEvaluation }) {
  const record: TrialRecord = { ...input, mode: "standard", owner: null,
    result: { ...input.result, evaluation_id: randomUUID(), evaluation_provenance: evaluationProvenance(input.rubric, input.assignmentText, "standard", false) }, expiresAt: Date.now() + RECOVERY_TTL_SECONDS * 1000 };
  let saved: number;
  try {
    saved = await recoveryRedis().eval<unknown[], number>(
    `if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
    redis.call('SET', KEYS[3], ARGV[2], 'EX', ARGV[3])
    redis.call('SET', KEYS[1], 'used', 'EX', ARGV[4]); redis.call('SET', KEYS[2], 'used', 'EX', ARGV[5]); return 1`,
    [...reservation.keys, recordKey(reservation.token)], [reservation.lease, JSON.stringify(record), RECOVERY_TTL_SECONDS, LIMIT_TTL, NETWORK_TTL]);
  } catch (error) {
    // Do not report a failed check if Redis saved it before the response was lost.
    const recovered = await recoveryRedis().get<TrialRecord>(recordKey(reservation.token)).catch(() => null);
    if (recovered?.result.evaluation_id === record.result.evaluation_id) return trialPreview(recovered.result);
    throw error;
  }
  if (!saved) {
    const recovered = await recoveryRedis().get<TrialRecord>(recordKey(reservation.token));
    if (recovered?.result.evaluation_id !== record.result.evaluation_id) throw new Error("TRIAL_SAVE_FAILED");
  }
  return trialPreview(record.result);
}
export async function claimTrial(identity: TrialIdentity, email: string): Promise<EvaluationRecord | null> {
  const redis = recoveryRedis();
  const key = recordKey(identity.token);
  const record = await redis.get<TrialRecord>(key);
  const owner = ownerHash(email);
  if (!record || record.expiresAt <= Date.now() || (record.owner && record.owner !== owner)) return null;
  const ttl = Math.floor((record.expiresAt - Date.now()) / 1000);
  if (ttl <= 0) return null;
  const claimed: EvaluationRecord = { ...record, owner };
  const saved = await redis.eval<unknown[], number>(
    `local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
    local record = cjson.decode(raw)
    if record.owner ~= cjson.null and record.owner ~= ARGV[1] then return 0 end
    redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
    redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3], 'NX'); return 1`,
    [key, recoveryKey(record.result.evaluation_id)], [owner, JSON.stringify(claimed), ttl]);
  return saved ? claimed : null;
}

