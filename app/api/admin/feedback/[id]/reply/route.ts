import { z } from "zod";
import { getAdminEmailFromRequest, isAdminAuthorized } from "../../../../../../src/lib/adminAuth";
import { createRequestContext, errorResponse, successJson } from "../../../../../../src/lib/apiError";
import { FeedbackReplyError, feedbackReplySchema, replyToFeedback } from "../../../../../../src/lib/productFeedbackReplies";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const errors: Record<string, [number, string]> = {
  FEEDBACK_NOT_FOUND: [404, "This feedback could not be found."],
  FEEDBACK_NO_RECIPIENT: [422, "This feedback has no reply email or account email."],
  FEEDBACK_MAIL_NOT_CONFIGURED: [503, "Configure the feedback sender, reply-to address and Resend API key before sending."],
  FEEDBACK_REPLY_BUSY: [409, "This reply is being processed. Wait a moment, then retry the same reply."],
  FEEDBACK_UNRESOLVED_REPLY: [409, "An earlier reply is still unconfirmed. Retry that reply before writing another one."],
  FEEDBACK_REPLY_REVIEW_REQUIRED: [409, "The delivery result is still unknown. Check Resend before sending another email; the safe retry window has expired."],
  FEEDBACK_DELIVERY_UNKNOWN: [502, "The delivery result is unknown. Retry the same reply to check it safely."],
  FEEDBACK_EMAIL_REJECTED: [502, "The email was not accepted. Check the sender domain and email configuration, then retry."],
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = createRequestContext(request);
  const fail = (status: number, code: string, message: string) => errorResponse(context, status, code, message, undefined, headers);
  if (!isAdminAuthorized(request)) return fail(401, "UNAUTHORIZED", "Admin access is required.");
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.slice(0, -1);
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== protocol + "://" + host)) {
    return fail(403, "FORBIDDEN", "Send replies from RubriCheck.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return fail(415, "INVALID_CONTENT_TYPE", "Send replies as JSON.");
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(400, "INVALID_FEEDBACK_ID", "Invalid feedback ID.");
  if (Number(request.headers.get("content-length")) > 64000) return fail(413, "REPLY_TOO_LARGE", "Please shorten your reply.");
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 64000) return fail(413, "REPLY_TOO_LARGE", "Please shorten your reply.");
    body = JSON.parse(raw);
  } catch { return fail(400, "INVALID_REPLY", "Enter a valid subject and message."); }
  const parsed = feedbackReplySchema.safeParse(body);
  if (!parsed.success) return fail(400, "INVALID_REPLY", "Enter a subject of up to 200 characters and a message of up to 10,000 characters.");
  try {
    const reply = await replyToFeedback(id, parsed.data, getAdminEmailFromRequest(request) ?? "Admin (secret authentication)");
    return successJson(context, { reply }, headers);
  } catch (error) {
    if (error instanceof FeedbackReplyError && errors[error.code]) {
      const [status, message] = errors[error.code];
      return errorResponse(context, status, error.code, message, error.reply ? { reply: error.reply } : undefined, headers);
    }
    console.error("ADMIN_FEEDBACK_REPLY_FAILED", { requestId: context.requestId });
    return fail(503, "FEEDBACK_REPLY_UNAVAILABLE", "Unable to confirm the reply. Retry the same reply to avoid a duplicate email.");
  }
}
