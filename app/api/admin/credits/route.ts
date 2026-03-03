import { adjustCredits } from "../../../../src/lib/credits";
import { isAdminAuthorized } from "../../../../src/lib/adminAuth";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";
import { isValidEmail, normalizeEmailInput } from "../../../../src/lib/entitlementRestoreShared";

export const runtime = "nodejs";

type AdminAdjustCreditsBody = {
  email?: unknown;
  delta?: unknown;
};

function normalizeDelta(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

export async function POST(request: Request) {
  const context = createRequestContext(request);

  if (!isAdminAuthorized(request)) {
    return errorResponse(context, 401, "UNAUTHORIZED", "Admin access is required.");
  }

  let body: AdminAdjustCreditsBody;
  try {
    body = (await request.json()) as AdminAdjustCreditsBody;
  } catch {
    return errorResponse(context, 400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const email = normalizeEmailInput(body.email);
  const delta = normalizeDelta(body.delta);
  if (!isValidEmail(email)) {
    return errorResponse(context, 400, "INVALID_EMAIL", "Please provide a valid account email.");
  }
  if (delta === null || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000) {
    return errorResponse(context, 400, "INVALID_DELTA", "Credit adjustment must be between -1000 and 1000, excluding 0.");
  }

  try {
    const result = await adjustCredits({ email, amount: delta });
    return successJson(context, {
      ok: true,
      email,
      delta,
      balance: result.balance,
      target:
        result.target.type === "customer"
          ? { type: "customer", customerId: result.target.customerId }
          : { type: "email", email: result.target.email },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ADMIN_CREDIT_ADJUST_FAILED";
    if (code === "INSUFFICIENT_CREDITS") {
      return errorResponse(context, 409, "INSUFFICIENT_CREDITS", "The account does not have enough credits for that deduction.");
    }
    if (code === "CREDIT_IDENTITY_MISSING") {
      return errorResponse(context, 400, "CREDIT_IDENTITY_MISSING", "Unable to resolve the account for that email.");
    }
    if (code === "SUPABASE_URL_MISSING" || code === "SUPABASE_SERVICE_ROLE_KEY_MISSING") {
      return errorResponse(context, 503, code, "Admin credit adjustment is unavailable until Supabase is configured.");
    }

    console.error("ADMIN_CREDIT_ADJUST_FAILED", { requestId: context.requestId, error, email, delta });
    return errorResponse(context, 500, "ADMIN_CREDIT_ADJUST_FAILED", "Unable to adjust credits right now.");
  }
}
