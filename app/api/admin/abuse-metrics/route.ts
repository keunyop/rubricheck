import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { getAbuseMetrics } from "../../../../src/lib/abuseTelemetry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);

  if (!isAdminAuthorized(request)) {
    return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.");
  }

  const metrics = await getAbuseMetrics();
  return successJson(context, metrics);
}
