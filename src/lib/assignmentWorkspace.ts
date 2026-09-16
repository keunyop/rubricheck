import { randomUUID } from "node:crypto";
import { restrictEvaluationFeedback } from "../../lib/gradeFinalization";
import type { GradingMode } from "../../lib/schema";
import { normalizeEvaluationId, ownerHash, recoveryRedis, type RecoverableResult } from "./evaluationRecovery";
import type { AssignmentHistoryItem, AssignmentProject, AssignmentWorkspace } from "./assignmentWorkspaceTypes";

// Account namespaces come exclusively from the verified session, never request data.
export function workspaceKey(email: string) { return `rubricheck:workspace:{${ownerHash(email)}}`; }
function resultKey(email: string, id: string) { return `${workspaceKey(email)}:result:${id}`; }

export async function listWorkspace(email: string): Promise<AssignmentWorkspace> {
  const entries = await recoveryRedis().hgetall<Record<string, AssignmentProject | AssignmentHistoryItem>>(workspaceKey(email)) ?? {};
  return {
    projects: Object.entries(entries).filter(([key]) => key.startsWith("p:")).map(([, value]) => value as AssignmentProject).sort((a, b) => b.createdAt - a.createdAt),
    assignments: Object.entries(entries).filter(([key]) => key.startsWith("a:")).map(([, value]) => value as AssignmentHistoryItem).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)),
  };
}

export async function getProject(email: string, id: string) {
  if (!normalizeEvaluationId(id)) return null;
  return recoveryRedis().hget<AssignmentProject>(workspaceKey(email), `p:${id}`);
}

export async function archiveAssignment(email: string, result: RecoverableResult, mode: GradingMode, projectId: string | null = null) {
  const item: AssignmentHistoryItem = {
    id: result.evaluation_id, title: result.title, projectId, createdAt: Date.now(), mode, overallRange: result.overall_range,
  };
  // Atomic insertion preserves creation order and user edits on retries/upgrades.
  // Only feedback is archived; raw inputs retain their separate recovery TTL.
  await recoveryRedis().eval(`
    local item = cjson.decode(ARGV[2])
    if item.projectId ~= cjson.null and redis.call('HEXISTS', KEYS[1], 'p:' .. item.projectId) == 0 then item.projectId = cjson.null end
    redis.call('HSETNX', KEYS[1], 'a:' .. ARGV[1], cjson.encode(item))
    redis.call('SET', KEYS[2], ARGV[3])
    return 1
  `, [workspaceKey(email), resultKey(email, item.id)], [item.id, JSON.stringify(item), JSON.stringify({ owner: ownerHash(email), result: restrictEvaluationFeedback(result), mode })]);
}

export async function getArchivedAssignment(email: string, id: string) {
  if (!normalizeEvaluationId(id)) return null;
  const record = await recoveryRedis().get<{ owner: string; result: RecoverableResult; mode: GradingMode }>(resultKey(email, id));
  if (!record || record.owner !== ownerHash(email)) return null;
  return { result: restrictEvaluationFeedback(record.result), mode: record.mode };
}

export async function createProject(email: string, name: string) {
  const project: AssignmentProject = { id: randomUUID(), name, createdAt: Date.now() };
  await recoveryRedis().hset(workspaceKey(email), { [`p:${project.id}`]: project });
  return project;
}

export async function editWorkspace(email: string, action: "renameProject" | "deleteProject" | "moveAssignment", id: string, value: string | null) {
  const status = await recoveryRedis().eval<unknown[], number>(`
    local field = (ARGV[1] == 'moveAssignment' and 'a:' or 'p:') .. ARGV[2]
    local raw = redis.call('HGET', KEYS[1], field)
    if not raw then return 0 end
    local item = cjson.decode(raw)
    if ARGV[1] == 'moveAssignment' then
      if ARGV[3] ~= '' and redis.call('HEXISTS', KEYS[1], 'p:' .. ARGV[3]) == 0 then return 0 end
      item.projectId = ARGV[3] == '' and cjson.null or ARGV[3]
    elseif ARGV[1] == 'renameProject' then item.name = ARGV[3]
    else
      local entries = redis.call('HGETALL', KEYS[1])
      for i = 1, #entries, 2 do
        if string.sub(entries[i], 1, 2) == 'a:' then
          local assignment = cjson.decode(entries[i + 1])
          if assignment.projectId == ARGV[2] then
            assignment.projectId = cjson.null
            redis.call('HSET', KEYS[1], entries[i], cjson.encode(assignment))
          end
        end
      end
      redis.call('HDEL', KEYS[1], field)
      return 1
    end
    redis.call('HSET', KEYS[1], field, cjson.encode(item))
    return 1
  `, [workspaceKey(email)], [action, id, value ?? ""]);
  if (!status) throw new Error("WORKSPACE_NOT_FOUND");
}
