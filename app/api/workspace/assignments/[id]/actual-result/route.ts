import { z } from "zod";
import { getCreditEmailFromCookie } from "../../../../../../src/lib/creditSession";
import { createRequestContext, errorResponse, successJson } from "../../../../../../src/lib/apiError";
import { actualResultInputSchema } from "../../../../../../src/lib/actualResultTypes";
import { readActualResult, saveActualResult, deleteActualResult } from "../../../../../../src/lib/actualResults";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };
const deletionSchema = z.object({ expectedRevision: z.string().uuid().nullable() }).strict();

async function handle(request: Request, { params }: RouteContext, action: "read" | "save" | "delete") {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to manage your actual results.");
  try {
    const { id } = await params;
    let actualResult;
    if (action === "read") actualResult = await readActualResult(email, id);
    else {
      const text = await request.text();
      if (text.length > 32_000) return errorResponse(context, 413, "INVALID_INPUT", "This record is too large.");
      let body: unknown;
      try { body = JSON.parse(text); } catch { return errorResponse(context, 400, "INVALID_INPUT", "Enter a valid actual result."); }
      if (action === "save") {
        const parsed = actualResultInputSchema.safeParse(body);
        if (!parsed.success) return errorResponse(context, 400, "INVALID_INPUT", "Enter a score within the maximum or a comment (up to 5,000 characters), and confirm personal record storage. Choose each optional consent separately.");
        actualResult = await saveActualResult(email, id, parsed.data);
      } else {
        const parsed = deletionSchema.safeParse(body);
        if (!parsed.success) return errorResponse(context, 400, "INVALID_INPUT", "Reload the saved record before deleting it.");
        await deleteActualResult(email, id, parsed.data.expectedRevision);
        actualResult = null;
      }
    }
    return successJson(context, { actualResult }, { "Cache-Control": "private, no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ASSIGNMENT_NOT_FOUND") return errorResponse(context, 404, message, "This saved assignment is unavailable. Reopen it from your history and try again.");
    if (message === "ACTUAL_RESULT_CONFLICT") return errorResponse(context, 409, message, "This record changed in another tab. Reload the saved record before making changes.");
    return errorResponse(context, 503, "ACTUAL_RESULT_UNAVAILABLE", "Could not access your actual result. Please try again.");
  }
}

export const GET = (request: Request, context: RouteContext) => handle(request, context, "read");
export const PUT = (request: Request, context: RouteContext) => handle(request, context, "save");
export const DELETE = (request: Request, context: RouteContext) => handle(request, context, "delete");
