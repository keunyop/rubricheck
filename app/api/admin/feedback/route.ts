import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { listFeedback } from "../../../../src/lib/productFeedback";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);
  const headers = { "Cache-Control": "no-store" };
  if (!isAdminAuthorized(request)) return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.", undefined, headers);
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset) || offset < 0) {
    return errorResponse(context, 400, "INVALID_OFFSET", "Invalid feedback page.", undefined, headers);
  }
  try {
    return successJson(context, await listFeedback(offset), headers);
  } catch {
    console.error("ADMIN_FEEDBACK_FETCH_FAILED", { requestId: context.requestId });
    return errorResponse(context, 503, "FEEDBACK_UNAVAILABLE", "Unable to load feedback. Please try again.", undefined, headers);
  }
}
