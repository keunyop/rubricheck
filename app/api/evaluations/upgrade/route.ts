import { POST as confirmCheckout } from "../../checkout/confirm/route";
import { getCreditEmailFromCookie } from "../../../../src/lib/creditSession";
import { getEvaluation, upgradeEvaluation } from "../../../../src/lib/evaluationRecovery";
import { mergeDetailedEvaluation } from "../../../../src/lib/mergeDetailedEvaluation";
import { evaluateAssignment } from "../../../../lib/evaluation";
import { buildFinalEvaluation } from "../../../../lib/gradeFinalization";
import { createRequestContext, errorResponse, successJson } from "../../../../src/lib/apiError";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Log in to resume your result.");
  try {
    // ID and paid tier come only from a verified Stripe session owned by this account.
    const confirmation = await confirmCheckout(request.clone());
    if (!confirmation.ok) return confirmation;
    const purchase = await confirmation.json();
    if (!purchase.ok) return successJson(context, { status: "pending" });
    const id = purchase.evaluationId;
    if (!id) return errorResponse(context, 409, "EVALUATION_NOT_LINKED", "This purchase has no linked evaluation.");
    const record = await getEvaluation(id, email);
    if (!record) return errorResponse(context, 410, "EVALUATION_EXPIRED", "The saved evaluation has expired.");
    // Completing the linked free result is included in the purchase: no new usage or credit reservation.
    const result = await upgradeEvaluation(id, email, async (original) => {
      const evaluation = await evaluateAssignment(original.rubric, original.assignmentText, original.mode, { detailLevel: "detailed" });
      const detailed = buildFinalEvaluation(original.rubric, evaluation, original.mode, purchase.mode === "pro" ? "pro" : "topup");
      return mergeDetailedEvaluation(original.result, detailed);
    });
    return successJson(context, { result, mode: record.mode });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UPGRADE_FAILED";
    if (code === "UPGRADE_PENDING") return errorResponse(context, 409, code, "Detailed feedback is already being prepared. Retry shortly.");
    if (code === "EVALUATION_EXPIRED") return errorResponse(context, 410, code, "The saved evaluation has expired.");
    return errorResponse(context, 503, "UPGRADE_FAILED", "Detailed feedback could not be prepared. Retry without another purchase.");
  }
}
