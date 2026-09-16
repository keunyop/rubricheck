import { getCreditEmailFromCookie } from "../../../../../src/lib/creditSession";
import { createRequestContext, errorResponse, successJson } from "../../../../../src/lib/apiError";
import { getArchivedAssignment } from "../../../../../src/lib/assignmentWorkspace";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to see your assignments.");
  try {
    const record = await getArchivedAssignment(email, (await params).id);
    if (!record) return errorResponse(context, 404, "ASSIGNMENT_NOT_FOUND", "This assignment is no longer available.");
    return successJson(context, record, { "Cache-Control": "no-store" });
  } catch {
    return errorResponse(context, 503, "WORKSPACE_UNAVAILABLE", "Could not open this assignment. Try again.");
  }
}
