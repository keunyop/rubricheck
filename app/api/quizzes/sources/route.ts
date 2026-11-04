import { randomUUID } from "node:crypto";
import { z } from "zod";
import { paragraphSegments, parseQuizFile } from "../../../../lib/quizParse";
import { quizAccount, quizErrorResponse, quizJson, quizResponse } from "../../../../src/lib/quizApi";
import { getQuizSource, quizKey, saveQuizSource } from "../../../../src/lib/quizStore";
import { QUIZ_LIMITS, quizId, type QuizSource } from "../../../../src/lib/quizTypes";
import { QuizError, selectQuizSources } from "../../../../src/lib/quizValidation";
import { getEvaluation, recoveryRedis } from "../../../../src/lib/evaluationRecovery";
import { listWorkspace } from "../../../../src/lib/assignmentWorkspace";
import { assignmentTitle, projectVersions } from "../../../../src/lib/assignmentWorkspaceTypes";

export const runtime = "nodejs";
export const maxDuration = 120;
const CHUNK_BYTES = 2 * 1024 * 1024;
const uploadKey = (email: string, id: string) => quizKey(email) + ":upload:" + id;
type Upload = { name: string; size: number; chunks: number; range: string };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("text"), name: z.string().trim().min(1).max(200), text: z.string().trim().min(20).max(QUIZ_LIMITS.characters) }),
  z.object({ action: z.literal("assignment"), id: quizId }),
  z.object({ action: z.literal("upload"), name: z.string().trim().min(1).max(200), size: z.number().int().positive().max(QUIZ_LIMITS.fileBytes), range: z.string().max(500).default("") }),
  z.object({ action: z.literal("extract"), id: quizId }),
]);

export async function GET(request: Request) {
  try {
    const email = quizAccount(request), id = new URL(request.url).searchParams.get("id");
    if (!quizId.safeParse(id).success) throw new QuizError("QUIZ_INVALID_INPUT");
    const source = await getQuizSource(email, id!);
    if (source.assignmentId && !await getEvaluation(source.assignmentId, email)) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
    return quizResponse({ source });
  } catch (error) { return quizErrorResponse(error); }
}

export async function POST(request: Request) {
  let unlock: (() => Promise<unknown>) | undefined;
  try {
    const email = quizAccount(request), parsed = schema.safeParse(await quizJson(request));
    if (!parsed.success) throw new QuizError("QUIZ_INVALID_INPUT");
    const data = parsed.data, now = Date.now();
    const base: QuizSource = { id: randomUUID(), name: "", kind: "text", unitKind: "paragraph", totalUnits: 0, segments: [], bytes: 0, receivedAt: now, expiresAt: now + QUIZ_LIMITS.retentionSeconds * 1000, assignmentId: null, version: null, projectId: null };
    let source: QuizSource;
    if (data.action === "upload") {
      if (!/\.(pdf|docx|pptx|txt|png|jpe?g)$/i.test(data.name)) throw new QuizError("QUIZ_FILE_TYPE");
      const id = randomUUID();
      const upload: Upload = { ...data, chunks: Math.ceil(data.size / CHUNK_BYTES) };
      await recoveryRedis().set(uploadKey(email, id), upload, { ex: 3600 });
      return quizResponse({ uploadId: id, chunkBytes: CHUNK_BYTES });
    }
    if (data.action === "text") {
      const segments = paragraphSegments(data.text);
      source = { ...base, name: data.name, segments, totalUnits: segments.length };
    } else if (data.action === "assignment") {
      const [record, workspace] = await Promise.all([getEvaluation(data.id, email), listWorkspace(email)]);
      if (!record) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
      const assignment = workspace.assignments.find(a => a.id === data.id);
      const segments = paragraphSegments(record.assignmentText);
      source = { ...base, kind: "assignment", assignmentId: data.id, name: assignment?.title ?? assignmentTitle(record.assignmentText), projectId: assignment?.projectId ?? null, version: assignment?.projectId ? projectVersions(workspace.assignments, assignment.projectId).findIndex(a => a.id === assignment.id) + 1 : 1, segments, totalUnits: segments.length, expiresAt: record.expiresAt, feedback: record.result.top_improvements };
    } else {
      const redis = recoveryRedis(), key = uploadKey(email, data.id);
      // Retried extraction returns the previously stored source; it does not renew retention.
      const saved = await redis.get<QuizSource>(quizKey(email) + ":source:" + data.id);
      if (saved && saved.expiresAt > now) return quizResponse({ source: saved });
      const upload = await redis.get<Upload>(key);
      if (!upload) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
      const lock = quizKey(email) + ":extract", token = randomUUID();
      if (!await redis.set(lock, token, { nx: true, ex: 120 })) throw new QuizError("QUIZ_BUSY", 409);
      unlock = () => redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", [lock], [token]);
      const parts = await Promise.all(Array.from({ length: upload.chunks }, (_, i) => redis.get<string>(key + ":" + i)));
      if (parts.some(p => !p)) throw new QuizError("QUIZ_UPLOAD_INCOMPLETE");
      const buffer = Buffer.concat(parts.map(p => Buffer.from(p!, "base64")));
      if (buffer.length !== upload.size) throw new QuizError("QUIZ_UPLOAD_INCOMPLETE");
      const file = new File([buffer], upload.name);
      const extracted = await parseQuizFile(file, upload.range);
      source = { ...base, ...extracted, id: data.id, name: upload.name, bytes: upload.size, receivedAt: Date.now(), expiresAt: Date.now() + QUIZ_LIMITS.retentionSeconds * 1000 };
      await saveQuizSource(email, source);
      await redis.del(key, ...parts.map((_, i) => key + ":" + i));
      return quizResponse({ source });
    }
    // Keep long assignments available for explicit paragraph selection. Their
    // original recovery TTL still bounds the entire copy; generation enforces 50k.
    if (source.kind !== "assignment") selectQuizSources([source], [{ id: source.id, units: source.segments.map(s => s.unit) }]);
    await saveQuizSource(email, source);
    return quizResponse({ source });
  } catch (error) { return quizErrorResponse(error); }
  finally { await unlock?.().catch(() => {}); }
}

export async function PUT(request: Request) {
  try {
    const email = quizAccount(request), url = new URL(request.url), id = url.searchParams.get("id"), index = Number(url.searchParams.get("index"));
    if (!quizId.safeParse(id).success || !Number.isInteger(index) || index < 0 || index > 9) throw new QuizError("QUIZ_INVALID_INPUT");
    if (Number(request.headers.get("content-length") ?? 0) > CHUNK_BYTES) throw new QuizError("QUIZ_FILE_LIMIT", 413);
    const redis = recoveryRedis(), key = uploadKey(email, id!);
    const upload = await redis.get<Upload>(key);
    if (!upload || index >= upload.chunks) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
    const buffer = Buffer.from(await request.arrayBuffer());
    const expected = Math.min(CHUNK_BYTES, upload.size - index * CHUNK_BYTES);
    if (buffer.length !== expected) throw new QuizError("QUIZ_UPLOAD_INCOMPLETE");
    await redis.set(key + ":" + index, buffer.toString("base64"), { ex: 3600 });
    return quizResponse({ ok: true });
  } catch (error) { return quizErrorResponse(error); }
}
