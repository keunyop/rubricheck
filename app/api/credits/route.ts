import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";
import { getCreditBalanceForRequest } from "../../../src/lib/credits";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = createRequestContext(request);
  try {
    const balance = await getCreditBalanceForRequest(request);
    return successJson(context, { balance, hasIdentity: balance !== null });
  } catch (error) {
    if (error instanceof Error && error.message === "UPSTASH_REDIS_CONFIG_MISSING") {
      return successJson(context, { balance: null, hasIdentity: false });
    }

    console.error("CREDITS_BALANCE_FETCH_FAILED", { requestId: context.requestId, error });
    return errorResponse(context, 500, "CREDITS_BALANCE_FETCH_FAILED", "Unable to load credits balance right now.");
  }
}
