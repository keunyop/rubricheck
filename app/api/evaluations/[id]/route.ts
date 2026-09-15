import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getEvaluation } from "../../../../src/lib/evaluationRecovery";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to resume your result.");
  try {
    const record = await getEvaluation((await params).id, email);
    if (!record) return errorResponse(context, 404, "EVALUATION_NOT_FOUND", "This saved evaluation is unavailable or has expired.");
    return successJson(context, { result: record.result, mode: record.mode }, { "Cache-Control": "no-store" });
  } catch {
    return errorResponse(context, 503, "RECOVERY_UNAVAILABLE", "Your saved result is temporarily unavailable.");
  }
}
