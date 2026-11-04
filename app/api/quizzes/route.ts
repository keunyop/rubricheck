import { after } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { quizAccount, quizErrorResponse, quizJson, quizPro, quizResponse } from "../../../src/lib/quizApi";
import { beginQuizJob, getQuizDetail, getQuizSource, listQuizzes, normalizeQuizRecord, quizKey, quizTransaction } from "../../../src/lib/quizStore";
import { quizGenerationSchema, quizId, type QuizJob } from "../../../src/lib/quizTypes";
import { QuizError, selectQuizSources } from "../../../src/lib/quizValidation";
import { getProject, listWorkspace } from "../../../src/lib/assignmentWorkspace";
import { getEvaluation, recoveryRedis } from "../../../src/lib/evaluationRecovery";

export const runtime = "nodejs";
export const maxDuration = 300;
function work(email: string, id: string) { after(async () => { const { runQuizJob } = await import("../../../src/lib/quizGeneration"); await runQuizJob(email, id); }); }

export async function GET(request: Request) {
  try {
    const email = quizAccount(request), url = new URL(request.url), id = url.searchParams.get("id");
    if (id) {
      if (!quizId.safeParse(id).success) throw new QuizError("QUIZ_INVALID_INPUT");
      const detail = await getQuizDetail(email, id);
      const workspace = await listWorkspace(email);
      if (!workspace.projects.some(p => p.id === detail.quiz.projectId)) detail.quiz.projectId = null;
      return quizResponse({ ...detail, linkedAssignmentIds: detail.quiz.sources.map(s => s.assignmentId).filter(id => id && workspace.assignments.some(a => a.id === id)) });
    }
    const [library, workspace] = await Promise.all([listQuizzes(email, await quizPro(email)), listWorkspace(email)]);
    for (const job of library.jobs) if (job.status === "queued") work(email, job.id);
    for (const quiz of library.quizzes) if (!workspace.projects.some(p => p.id === quiz.projectId)) quiz.projectId = null;
    return quizResponse({ ...library, workspace });
  } catch (error) { return quizErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const email = quizAccount(request);
    const parsed = quizGenerationSchema.safeParse(await quizJson(request));
    if (!parsed.success) throw new QuizError("QUIZ_INVALID_INPUT");
    const input = parsed.data;
    const existing = await recoveryRedis().hget<QuizJob>(quizKey(email), "j:" + input.requestId);
    if (existing) {
      const fingerprint = createHash("sha256").update(JSON.stringify({ settings: input.settings, sources: input.sources })).digest("hex");
      if (existing.fingerprint !== fingerprint) throw new QuizError("QUIZ_REQUEST_CONFLICT", 409);
      if (existing.status === "queued") work(email, existing.id);
      const { token, ...job } = existing;
      void token;
      return quizResponse({ job: normalizeQuizRecord(job) });
    }
    if (input.settings.projectId && !await getProject(email, input.settings.projectId)) throw new QuizError("QUIZ_NOT_FOUND", 404);
    const originals = await Promise.all(input.sources.map(s => getQuizSource(email, s.id)));
    for (const source of originals) if (source.assignmentId && !await getEvaluation(source.assignmentId, email)) throw new QuizError("QUIZ_SOURCE_EXPIRED", 410);
    const { sources, refs } = selectQuizSources(originals, input.sources);
    if (input.settings.purpose === "improvements" && !sources.some(s => s.kind === "assignment" && s.feedback?.length)) throw new QuizError("QUIZ_NO_IMPROVEMENTS");
    if (input.settings.purpose === "topic" && !input.settings.topic) throw new QuizError("QUIZ_INVALID_INPUT");
    const job = await beginQuizJob(email, { ...input, sources: refs }, await quizPro(email));
    if (job.status === "queued") work(email, job.id);
    return quizResponse({ job }, 202);
  } catch (error) { return quizErrorResponse(error); }
}

const editSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), quizId, title: z.string().trim().min(1).max(120).optional(), projectId: quizId.nullable().optional() }),
  z.object({ action: z.literal("delete"), quizId }),
  z.object({ action: z.literal("report"), quizId, questionId: z.string().min(1).max(10), reason: z.enum(["answer", "ambiguous", "source", "other"]) }),
]);
export async function PATCH(request: Request) {
  try {
    const email = quizAccount(request), parsed = editSchema.safeParse(await quizJson(request));
    if (!parsed.success) throw new QuizError("QUIZ_INVALID_INPUT");
    const { action, ...input } = parsed.data;
    return quizResponse(await quizTransaction(email, action, input));
  } catch (error) { return quizErrorResponse(error); }
}
