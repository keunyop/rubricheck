import { z } from "zod";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";
import { archiveAssignment, createProject, editWorkspace, listWorkspace } from "../../../src/lib/assignmentWorkspace";
import { getEvaluation } from "../../../src/lib/evaluationRecovery";

import { assignmentTitle } from "../../../src/lib/assignmentWorkspaceTypes";

export const runtime = "nodejs";
const id = z.string().uuid();
const name = z.string().trim().min(1).max(80);
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createProject"), name }),
  z.object({ action: z.literal("renameProject"), id, name }),
  z.object({ action: z.literal("deleteProject"), id }),
  z.object({ action: z.literal("moveAssignment"), id, projectId: id.nullable() }),
  z.object({ action: z.literal("importEvaluation"), id }),
]);

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to see your assignments.");
  try {
    return successJson(context, await listWorkspace(email), { "Cache-Control": "no-store" });
  } catch {
    return errorResponse(context, 503, "WORKSPACE_UNAVAILABLE", "Could not load your assignments. Try again.");
  }
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to manage your assignments.");
  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return errorResponse(context, 400, "INVALID_INPUT", "Enter a project name of up to 80 characters and a valid assignment.");
  try {
    const data = input.data;
    let project;
    if (data.action === "createProject") project = await createProject(email, data.name);
    else if (data.action === "importEvaluation") {
      const record = await getEvaluation(data.id, email);
      if (!record) return errorResponse(context, 404, "WORKSPACE_NOT_FOUND", "This result is no longer available.");
      await archiveAssignment(email, {
        ...record.result,
        title: record.result.title === "Evaluation Summary" ? assignmentTitle(record.assignmentText) : record.result.title,
      }, record.mode);
    } else {
      await editWorkspace(email, data.action, data.id, data.action === "renameProject" ? data.name : data.action === "moveAssignment" ? data.projectId : null);
    }
    return successJson(context, { ok: true, project }, { "Cache-Control": "no-store" });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") return errorResponse(context, 404, "WORKSPACE_NOT_FOUND", "This assignment or project is no longer available.");
    return errorResponse(context, 503, "WORKSPACE_UNAVAILABLE", "Could not save your changes. Try again.");
  }
}
