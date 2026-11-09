import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { getAdminQuizDetail, getAdminQuizList } from "../../../../src/lib/adminQuizLibrary";
import { getAdminQuizMetrics } from "../../../../src/lib/adminQuizMetrics";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const context = createRequestContext(request);
  let authorized = false;
  try { authorized = isAdminAuthorized(request); } catch {}
  if (!authorized) return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.", undefined, headers);
  const searchParams = new URL(request.url).searchParams;
  try {
    if (searchParams.get("view") === "list") {
      const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
      const limit = Number.parseInt(searchParams.get("limit") ?? "25", 10);
      return successJson(context, await getAdminQuizList({
        query: searchParams.get("q") ?? "",
        offset: Number.isFinite(offset) ? offset : 0,
        limit: Number.isFinite(limit) ? limit : 25,
      }), headers);
    }
    if (searchParams.get("view") === "detail") {
      const detail = await getAdminQuizDetail(searchParams.get("owner") ?? "", searchParams.get("id") ?? "");
      if (!detail) return errorResponse(context, 404, "QUIZ_NOT_FOUND", "Quiz not found.", undefined, headers);
      return successJson(context, detail, headers);
    }
    return successJson(context, await getAdminQuizMetrics(searchParams.get("refresh") === "1"), headers);
  }
  catch {
    return errorResponse(context, 503, "QUIZ_ADMIN_UNAVAILABLE", "Unable to load quiz activity. Please retry.", undefined, headers);
  }
}
