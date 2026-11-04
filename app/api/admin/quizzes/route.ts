import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { getAdminQuizMetrics } from "../../../../src/lib/adminQuizMetrics";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const context = createRequestContext(request);
  let authorized = false;
  try { authorized = isAdminAuthorized(request); } catch {}
  if (!authorized) return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.", undefined, headers);
  try { return successJson(context, await getAdminQuizMetrics(new URL(request.url).searchParams.get("refresh") === "1"), headers); }
  catch {
    return errorResponse(context, 503, "QUIZ_METRICS_UNAVAILABLE", "Unable to load quiz activity. Please retry.", undefined, headers);
  }
}
