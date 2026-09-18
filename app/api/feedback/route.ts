import { createRequestContext, errorResponse, successJson } from "../../../src/lib/apiError";
import { getCreditEmailFromCookie } from "../../../src/lib/creditSession";
import { getEntitlementEmailFromCookie } from "../../../src/lib/entitlementSession";
import { feedbackSchema, submitFeedback } from "../../../src/lib/productFeedback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = createRequestContext(request);
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.slice(0, -1);
  if (origin && origin !== protocol + "://" + host) {
    return errorResponse(context, 403, "FORBIDDEN", "Submit feedback from RubriCheck.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return errorResponse(context, 415, "INVALID_CONTENT_TYPE", "Send feedback as JSON.");
  }
  if (Number(request.headers.get("content-length")) > 24000) {
    return errorResponse(context, 413, "FEEDBACK_TOO_LARGE", "Please shorten your feedback.");
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 24000) return errorResponse(context, 413, "FEEDBACK_TOO_LARGE", "Please shorten your feedback.");
    body = JSON.parse(raw);
  } catch {
    return errorResponse(context, 400, "INVALID_FEEDBACK", "Please enter valid feedback.");
  }
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) return errorResponse(context, 400, "INVALID_FEEDBACK", "Enter a message of up to 5,000 characters and a valid email if provided.");

  try {
    const email = getCreditEmailFromCookie(request) ?? getEntitlementEmailFromCookie(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
    const saved = await submitFeedback(parsed.data, email, ip);
    if (!saved) return errorResponse(context, 429, "FEEDBACK_LIMIT", "You have sent several messages. Please try again in an hour.", undefined, { "Retry-After": "3600" });
    return successJson(context, { ok: true }, { "Cache-Control": "no-store" });
  } catch {
    console.error("FEEDBACK_SUBMIT_FAILED", { requestId: context.requestId });
    return errorResponse(context, 503, "FEEDBACK_UNAVAILABLE", "Your feedback could not be sent. Please try again.");
  }
}
