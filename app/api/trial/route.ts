import { NextResponse } from "next/server";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import { trialIdentity, setTrialCookie, readTrial, claimTrial } from "../../../src/lib/guestTrial";
import { archiveAssignment } from "../../../src/lib/assignmentWorkspace";
import { getEvaluation } from "../../../src/lib/evaluationRecovery";
import { createRequestContext, errorResponse } from "../../../src/lib/apiError";

export async function GET(request: Request) {
  const identity = trialIdentity(request);
  try {
    return setTrialCookie(NextResponse.json(await readTrial(identity)), identity);
  } catch {
    return errorResponse(createRequestContext(request), 503, "TRIAL_UNAVAILABLE", "The preview is temporarily unavailable. Please retry shortly.");
  }
}

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const email = getCreditEmailFromCookie(request);
  if (!email) return errorResponse(context, 401, "AUTH_REQUIRED", "Sign up to see criterion feedback.");
  try {
    const claimed = await claimTrial(trialIdentity(request), email);
    if (!claimed) return errorResponse(context, 404, "TRIAL_EXPIRED", "This preview has expired. Your free account checks are ready to use.");
    // Re-read to preserve any subsequent paid upgrade when a claim is retried.
    const record = await getEvaluation(claimed.result.evaluation_id, email);
    if (!record) throw new Error("RECOVERY_STORE_UNAVAILABLE");
    const response = NextResponse.json({ result: record.result, mode: record.mode }, { headers: { "Cache-Control": "private, no-store" } });
    try { await archiveAssignment(email, record.result, record.mode, null); }
    catch { response.headers.set("x-history-unavailable", "1"); }
    return response;
  } catch {
    return errorResponse(context, 503, "TRIAL_UNAVAILABLE", "Could not open your preview. Please retry shortly.");
  }
}

