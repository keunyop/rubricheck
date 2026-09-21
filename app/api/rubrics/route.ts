import { z } from "zod";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";
import { downloadRubricFile, editSavedRubric, getSavedRubric, listRubrics, validRubricId } from "../../../src/lib/rubricLibrary";
import { RUBRIC_NAME_LIMIT } from "../../../src/lib/rubricLibraryTypes";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to open your rubrics.");
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id !== null && !validRubricId(id)) return errorResponse(context, 400, "INVALID_INPUT", "Choose a saved rubric.");
  try {
    if (id === null) return successJson(context, { rubrics: await listRubrics(email) }, headers);
    if (params.has("file")) {
      const index = params.get("file")!;
      if (!/^\d+$/.test(index)) return errorResponse(context, 400, "INVALID_INPUT", "Choose a rubric file.");
      const download = await downloadRubricFile(email, id, Number(index));
      if (!download) return errorResponse(context, 404, "RUBRIC_NOT_FOUND", "This rubric file is no longer available.");
      const filename = encodeURIComponent(download.file.name.replace(/[\x00-\x1f]/g, "")).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`);
      return new Response(new Uint8Array(download.bytes), { headers: {
        ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(download.bytes.length),
        "Content-Disposition": `attachment; filename="rubric"; filename*=UTF-8''${filename}`,
      } });
    }
    const item = await getSavedRubric(email, id);
    if (!item) return errorResponse(context, 404, "RUBRIC_NOT_FOUND", "This rubric is no longer available.");
    return successJson(context, { rubric: { id: item.id, name: item.name, lastUsedAt: item.lastUsedAt, files: item.files, text: item.text } }, headers);
  } catch {
    return errorResponse(context, 503, "RUBRIC_LIBRARY_UNAVAILABLE", "Could not load your rubrics. Try again.");
  }
}

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), id: z.string().refine(validRubricId), name: z.string().trim().min(1).max(RUBRIC_NAME_LIMIT) }),
  z.object({ action: z.literal("delete"), id: z.string().refine(validRubricId) }),
]);
export async function POST(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to manage your rubrics.");
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(context, 400, "INVALID_INPUT", "Use a rubric name of 1–80 characters.");
  try {
    const data = parsed.data;
    if (!await editSavedRubric(email, data.id, data.action, data.action === "rename" ? data.name : undefined)) {
      return errorResponse(context, 404, "RUBRIC_NOT_FOUND", "This rubric is no longer available.");
    }
    return successJson(context, { ok: true }, headers);
  } catch {
    return errorResponse(context, 503, "RUBRIC_LIBRARY_UNAVAILABLE", "Could not save your changes. Try again.");
  }
}
