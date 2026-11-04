import { createHash, randomUUID } from "node:crypto";
import { ownerHash, recoveryRedis } from "./evaluationRecovery";
import { workspaceKey } from "./assignmentWorkspace";
import { QuizError } from "./quizValidation";
import { QUIZ_LIMITS, summarizeQuiz, type Quiz, type QuizAttempt, type QuizDetail, type QuizJob, type QuizLibrary, type QuizSettings, type QuizSource, type QuizSourceRef } from "./quizTypes";

export function quizKey(email: string) { return `rubricheck:quiz:{${ownerHash(email)}}`; }
export function quizSourceKey(email: string, id: string) { return `${quizKey(email)}:source:${id}`; }

// Upstash Lua drops JSON null fields and encodes an empty table as []. Restore
// the public record shape at the storage boundary, including active attempts.
export function normalizeQuizRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeQuizRecord);
  if (!value || typeof value !== "object") return value;
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeQuizRecord(item)]));
  if ("settings" in record && "sources" in record) {
    const settings = record.settings as Record<string, unknown>;
    settings.projectId ??= null;
    if ("questions" in record) record.projectId ??= null;
    if ("fingerprint" in record) { record.quizId ??= null; record.error ??= null; }
  }
  if ("unitKind" in record && "expiresAt" in record) { record.assignmentId ??= null; record.projectId ??= null; record.version ??= null; }
  if ("questionIds" in record && "revision" in record) { record.completedAt ??= null; if (Array.isArray(record.answers) && !record.answers.length) record.answers = {}; }
  return record;
}

// Every mutation of jobs, usage, quizzes and attempts runs in one Redis transaction.
// Lease expiry releases reservations; an old worker cannot commit after its lease.
export const QUIZ_TRANSACTION = `
local action, now = ARGV[1], tonumber(ARGV[2])
local input = cjson.decode(ARGV[3])
local function read(field)
  local raw = redis.call('HGET', KEYS[1], field)
  if raw then return cjson.decode(raw) end
  return nil
end
local function write(field, value) redis.call('HSET', KEYS[1], field, cjson.encode(value)) end
local function fail(code) return cjson.encode({error=code}) end
local active = redis.call('HGET', KEYS[1], 'active')
if active then
  local job = read('j:' .. active)
  if not job or job.leaseUntil <= now or job.status == 'completed' or job.status == 'failed' then
    if job and job.status ~= 'completed' and job.status ~= 'failed' then
      job.status = 'failed'; job.error = 'QUIZ_INTERRUPTED'; job.reserved = 0; job.token = nil
      write('j:' .. active, job)
    end
    redis.call('HDEL', KEYS[1], 'active'); active = nil
  end
end
if action == 'sweep' then return 'true' end
if action == 'begin' then
  local existing = read('j:' .. input.id)
  if existing then
    if existing.fingerprint ~= input.fingerprint then return fail('QUIZ_REQUEST_CONFLICT') end
    return cjson.encode(existing)
  end
  if active then return fail('QUIZ_BUSY') end
  local used = tonumber(redis.call('HGET', KEYS[1], 'used') or '0')
  if not input.pro and used + input.reserved > 10 then return fail('QUIZ_LIMIT_REACHED') end
  write('j:' .. input.id, input); redis.call('HSET', KEYS[1], 'active', input.id)
  return cjson.encode(input)
end
if action == 'claim' or action == 'stage' or action == 'finish' or action == 'fail' then
  local job = read('j:' .. input.id)
  if not job then return fail('QUIZ_NOT_FOUND') end
  if job.status == 'completed' or job.status == 'failed' then return cjson.encode(job) end
  if action == 'claim' then
    if job.status ~= 'queued' then return 'null' end
    job.status = 'generating'; job.token = input.token
  else
    if job.token ~= input.token or active ~= job.id then return fail('QUIZ_REQUEST_CONFLICT') end
    if action == 'stage' then job.status = 'validating'
    elseif action == 'finish' then
      local count = #input.quiz.questions
      if count < 1 or count > job.settings.count then return fail('QUIZ_GENERATION_FAILED') end
      if input.quiz.projectId ~= cjson.null and redis.call('HEXISTS', KEYS[2], 'p:' .. input.quiz.projectId) == 0 then input.quiz.projectId = cjson.null end
      write('q:' .. input.quiz.id, input.quiz)
      if not job.pro then redis.call('HINCRBY', KEYS[1], 'used', count) end
      job.status = 'completed'; job.quizId = input.quiz.id; job.generatedCount = count
      job.reserved = 0; job.token = nil; redis.call('HDEL', KEYS[1], 'active')
    else
      job.status = 'failed'; job.error = input.error; job.reserved = 0; job.token = nil
      redis.call('HDEL', KEYS[1], 'active')
    end
  end
  write('j:' .. job.id, job); return cjson.encode(job)
end
local quiz = read('q:' .. input.quizId)
if not quiz then return fail('QUIZ_NOT_FOUND') end
if action == 'edit' then
  if input.title then quiz.title = input.title end
  if input.projectId ~= nil or input.clearProject then
    if not input.clearProject and input.projectId ~= cjson.null and redis.call('HEXISTS', KEYS[2], 'p:' .. input.projectId) == 0 then return fail('QUIZ_NOT_FOUND') end
    quiz.projectId = input.projectId
  end
  write('q:' .. quiz.id, quiz); return cjson.encode(quiz)
end
if action == 'delete' then
  local fields = redis.call('HKEYS', KEYS[1])
  for _, field in ipairs(fields) do
    if string.sub(field, 1, 2) == 't:' or string.sub(field, 1, 2) == 'r:' then
      local item = read(field)
      if item.quizId == quiz.id then redis.call('HDEL', KEYS[1], field) end
    end
  end
  redis.call('HDEL', KEYS[1], 'q:' .. quiz.id)
  return 'true'
end
if action == 'report' then
  local found = false
  for _, q in ipairs(quiz.questions) do if q.id == input.questionId then found = true end end
  if not found then return fail('QUIZ_NOT_FOUND') end
  write('r:' .. quiz.id .. ':' .. input.questionId, input); return 'true'
end
if action == 'start' then
  local existing = read('t:' .. input.id)
  if existing then
    if existing.quizId ~= quiz.id then return fail('QUIZ_REQUEST_CONFLICT') end
    return cjson.encode(existing)
  end
  local ids = {}
  local previous = nil
  if input.kind == 'review' then
    previous = read('t:' .. input.fromAttempt)
    if not previous or previous.quizId ~= quiz.id or previous.completedAt == cjson.null then return fail('QUIZ_NOT_FOUND') end
  end
  for _, q in ipairs(quiz.questions) do
    local include = not previous
    if previous then
      for _, id in ipairs(previous.questionIds) do if id == q.id and previous.answers[id] ~= q.answer then include = true end end
    end
    if include then table.insert(ids, q.id) end
  end
  if #ids == 0 then return fail('QUIZ_NO_REVIEW') end
  local fields = redis.call('HKEYS', KEYS[1])
  for _, field in ipairs(fields) do
    if string.sub(field, 1, 2) == 't:' then
      local attempt = read(field)
      if attempt.quizId == quiz.id and attempt.completedAt == cjson.null then
        if not input.restart then return cjson.encode(attempt) end
        attempt.completedAt = now; attempt.updatedAt = now; attempt.revision = attempt.revision + 1; write(field, attempt)
      end
    end
  end
  local attempt = {id=input.id, quizId=quiz.id, kind=input.kind, questionIds=ids, answers={}, position=0, startedAt=now, updatedAt=now, completedAt=cjson.null, revision=0}
  write('t:' .. input.id, attempt); return cjson.encode(attempt)
end
if action == 'answer' then
  local attempt = read('t:' .. input.id)
  if not attempt or attempt.quizId ~= quiz.id then return fail('QUIZ_NOT_FOUND') end
  if attempt.revision ~= input.revision then return fail('QUIZ_ATTEMPT_CONFLICT') end
  if attempt.completedAt ~= cjson.null then return fail('QUIZ_ATTEMPT_COMPLETED') end
  if input.questionId then
    local included, question = false, nil
    for _, id in ipairs(attempt.questionIds) do if id == input.questionId then included = true end end
    for _, q in ipairs(quiz.questions) do if q.id == input.questionId then question = q end end
    if not included or not question or input.answer < 0 or input.answer >= #question.options then return fail('QUIZ_INVALID_ANSWER') end
    if attempt.answers[input.questionId] ~= nil and attempt.answers[input.questionId] ~= input.answer then return fail('QUIZ_ANSWER_LOCKED') end
    attempt.answers[input.questionId] = input.answer
  end
  if input.position then
    if input.position < 0 or input.position >= #attempt.questionIds then return fail('QUIZ_INVALID_RANGE') end
    attempt.position = input.position
  end
  if input.finish then attempt.completedAt = now end
  attempt.updatedAt = now; attempt.revision = attempt.revision + 1
  write('t:' .. input.id, attempt); return cjson.encode(attempt)
end
return fail('QUIZ_INVALID_INPUT')
`;

export async function quizTransaction<T>(email: string, action: string, input: object = {}): Promise<T> {
  const payload = action === "edit" && "projectId" in input && input.projectId === null ? { ...input, clearProject: true } : input;
  const raw = await recoveryRedis().eval<unknown[], T | { error: string }>(QUIZ_TRANSACTION, [quizKey(email), workspaceKey(email)], [action, Date.now(), JSON.stringify(payload)]);
  const result = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (result && typeof result === "object" && "error" in result && !("status" in result) && result.error) {
    const code = String(result.error);
    throw new QuizError(code, code === "QUIZ_NOT_FOUND" ? 404 : code === "QUIZ_LIMIT_REACHED" ? 402 : 409);
  }
  return normalizeQuizRecord(result) as T;
}

export async function saveQuizSource(email: string, source: QuizSource) {
  const ttl = Math.floor((source.expiresAt - Date.now()) / 1000);
  if (ttl <= 0) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
  await recoveryRedis().set(quizSourceKey(email, source.id), source, { ex: ttl });
  return source;
}

export async function getQuizSource(email: string, id: string) {
  const source = await recoveryRedis().get<QuizSource>(quizSourceKey(email, id));
  if (!source || source.expiresAt <= Date.now()) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
  return source;
}

export async function quizRecords(email: string) {
  await quizTransaction(email, "sweep");
  const records = await recoveryRedis().hgetall<Record<string, Quiz | QuizJob | QuizAttempt | number | string>>(quizKey(email)) ?? {};
  return normalizeQuizRecord(records) as typeof records;
}

export async function listQuizzes(email: string, pro: boolean): Promise<QuizLibrary> {
  const records = await quizRecords(email);
  const quizzes = Object.entries(records).filter(([key]) => key.startsWith("q:")).map(([, value]) => value as Quiz);
  const jobs = Object.entries(records).filter(([key]) => key.startsWith("j:")).map(([, value]) => { const { token, ...job } = value as QuizJob; void token; return job; });
  const attempts = Object.entries(records).filter(([key]) => key.startsWith("t:")).map(([, value]) => value as QuizAttempt);
  const reserved = jobs.filter(j => j.status !== "failed" && j.status !== "completed").reduce((sum, j) => sum + j.reserved, 0);
  const used = Number(records.used ?? 0);
  return { quizzes: quizzes.map(q => summarizeQuiz(q, attempts)).sort((a, b) => b.createdAt - a.createdAt), jobs: jobs.sort((a, b) => b.createdAt - a.createdAt), access: { pro, used, reserved, remaining: Math.max(0, QUIZ_LIMITS.free - used - reserved) } };
}

export async function getQuizDetail(email: string, id: string): Promise<QuizDetail> {
  const records = await quizRecords(email);
  const quiz = records[`q:${id}`] as Quiz | undefined;
  if (!quiz) throw new QuizError("QUIZ_NOT_FOUND", 404);
  const attempts = Object.entries(records).filter(([key, value]) => key.startsWith("t:") && (value as QuizAttempt).quizId === id).map(([, value]) => value as QuizAttempt).sort((a, b) => b.updatedAt - a.updatedAt);
  return { quiz, attempts };
}

export async function beginQuizJob(email: string, input: { requestId: string; settings: QuizSettings; sources: QuizSourceRef[] }, pro: boolean): Promise<QuizJob> {
  const now = Date.now();
  const fingerprint = createHash("sha256").update(JSON.stringify({ settings: input.settings, sources: input.sources.map(s => ({ id: s.id, units: s.units })) })).digest("hex");
  return quizTransaction(email, "begin", { id: input.requestId, fingerprint, settings: input.settings, sources: input.sources, pro, reserved: pro ? 0 : input.settings.count, status: "queued", createdAt: now, leaseUntil: now + QUIZ_LIMITS.leaseMs, quizId: null, generatedCount: 0, error: null } satisfies QuizJob);
}

export async function claimQuizJob(email: string, id: string): Promise<QuizJob | null> {
  const job = await quizTransaction<QuizJob | null>(email, "claim", { id, token: randomUUID() });
  return job?.status === "generating" && job.token ? job : null;
}

// Used by the existing support-driven account deletion process. Usage is deliberately
// excluded from quiz deletion; account erasure removes the entire quiz namespace.
export async function deleteQuizAccountData(email: string) {
  const redis = recoveryRedis();
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { match: quizKey(email) + "*", count: 100 });
    if (keys.length) await redis.del(...keys);
    cursor = String(next);
  } while (cursor !== "0");
}
