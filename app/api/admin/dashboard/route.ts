import { getAdminEmailFromRequest, isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getAdminDashboardData } from "../../../../src/lib/adminDashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);

  if (!isAdminAuthorized(request)) {
    return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.");
  }

  try {
    const dashboard = await getAdminDashboardData();
    return successJson(context, {
      adminEmail: getAdminEmailFromRequest(request),
      ...dashboard,
    });
  } catch (error) {
    console.error("ADMIN_DASHBOARD_FETCH_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "ADMIN_DASHBOARD_FETCH_FAILED", "Unable to load admin dashboard right now.");
  }
}
