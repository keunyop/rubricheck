import { randomUUID } from "node:crypto";
import { getArchivedAssignment, workspaceKey } from "./assignmentWorkspace";
import { normalizeEvaluationId, ownerHash, recoveryRedis } from "./evaluationRecovery";
import { ACTUAL_RESULT_CONSENT_VERSION, type ActualResult, type ActualResultInput } from "./actualResultTypes";

function keys(email: string, id: string) {
  const archive = workspaceKey(email) + ":result:" + id;
  return { archive, actual: archive + ":actual" };
}

export async function readActualResult(email: string, id: string) {
  if (!normalizeEvaluationId(id) || !await getArchivedAssignment(email, id)) throw new Error("ASSIGNMENT_NOT_FOUND");
  return recoveryRedis().get<ActualResult>(keys(email, id).actual);
}

export async function saveActualResult(email: string, id: string, input: ActualResultInput): Promise<ActualResult> {
  if (!normalizeEvaluationId(id)) throw new Error("ASSIGNMENT_NOT_FOUND");
  const archived = await getArchivedAssignment(email, id);
  if (!archived) throw new Error("ASSIGNMENT_NOT_FOUND");
  const { expectedRevision, ...fields } = input;
  const now = Date.now();
  const record: ActualResult = { ...fields, evaluationId: id, revision: randomUUID(), createdAt: now, updatedAt: now,
    consentVersion: ACTUAL_RESULT_CONSENT_VERSION, consentUpdatedAt: now,
    estimate: { overallRange: archived.result.overall_range, mode: archived.mode,
      scoringVersion: archived.result.score_calculation?.version ?? null,
      provenance: archived.result.evaluation_provenance ?? null } };
  const key = keys(email, id);
  // Compare-and-set prevents stale tabs from silently restoring withdrawn consent.
  // The original estimate survives edits, detail upgrades and archive retries.
  const saved = await recoveryRedis().eval<unknown[], ActualResult | string | number>(`
    local archive = redis.call('GET', KEYS[2])
    if not archive or cjson.decode(archive).owner ~= ARGV[3] then return 0 end
    local raw = redis.call('GET', KEYS[1])
    local previous = raw and cjson.decode(raw) or nil
    if (previous and previous.revision or '') ~= ARGV[1] then return -1 end
    local record = cjson.decode(ARGV[2])
    if previous then
      record.createdAt = previous.createdAt
      record.estimate = previous.estimate
      if previous.consentVersion == record.consentVersion and previous.consent.personalRecord == record.consent.personalRecord and previous.consent.qualityValidation == record.consent.qualityValidation and previous.consent.publicCase == record.consent.publicCase then
        record.consentUpdatedAt = previous.consentUpdatedAt
      end
    end
    local encoded = cjson.encode(record)
    redis.call('SET', KEYS[1], encoded)
    return encoded
  `, [key.actual, key.archive], [expectedRevision ?? "", JSON.stringify(record), ownerHash(email)]);
  if (saved === 0) throw new Error("ASSIGNMENT_NOT_FOUND");
  if (saved === -1) throw new Error("ACTUAL_RESULT_CONFLICT");
  // Upstash automatically deserializes JSON replies.
  return typeof saved === "string" ? JSON.parse(saved) as ActualResult : saved as ActualResult;
}

export async function deleteActualResult(email: string, id: string, expectedRevision: string | null) {
  if (!normalizeEvaluationId(id)) throw new Error("ASSIGNMENT_NOT_FOUND");
  const key = keys(email, id);
  const status = await recoveryRedis().eval<unknown[], number>(`
    local archive = redis.call('GET', KEYS[2])
    if not archive or cjson.decode(archive).owner ~= ARGV[2] then return 0 end
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 1 end
    if cjson.decode(raw).revision ~= ARGV[1] then return -1 end
    redis.call('DEL', KEYS[1])
    return 1
  `, [key.actual, key.archive], [expectedRevision ?? "", ownerHash(email)]);
  if (status === 0) throw new Error("ASSIGNMENT_NOT_FOUND");
  if (status === -1) throw new Error("ACTUAL_RESULT_CONFLICT");
}
