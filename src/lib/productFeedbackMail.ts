import { z } from "zod";
import type { FeedbackMailSettings, FeedbackReply } from "./productFeedbackTypes";

export function getFeedbackMailSettings(): FeedbackMailSettings {
  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() || "RubriCheck Support <support@mail.rubricheck.com>";
  const replyTo = process.env.FEEDBACK_REPLY_TO_EMAIL?.trim() || null;
  const fromAddress = from.match(/<([^<>]+)>$/)?.[1] ?? from;
  return {
    from, replyTo,
    ready: Boolean(process.env.RESEND_API_KEY?.trim()) && !/[\r\n]/.test(from)
      && z.email().safeParse(fromAddress).success && z.email().safeParse(replyTo).success,
  };
}

export class FeedbackDeliveryError extends Error {
  readonly uncertain: boolean;
  constructor(uncertain: boolean) {
    super(uncertain ? "FEEDBACK_DELIVERY_UNKNOWN" : "FEEDBACK_EMAIL_REJECTED");
    this.uncertain = uncertain;
  }
}

export async function sendFeedbackEmail(feedbackId: string, reply: FeedbackReply): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY?.trim(),
        "Content-Type": "application/json",
        "Idempotency-Key": "feedback/" + feedbackId + "/" + reply.id,
      },
      body: JSON.stringify({ from: reply.from, to: [reply.to], reply_to: reply.replyTo, subject: reply.subject, text: reply.message }),
      signal: AbortSignal.timeout(12000),
    });
  } catch { throw new FeedbackDeliveryError(true); }
  // A server error or an idempotency conflict may follow an accepted request.
  if (!response.ok) throw new FeedbackDeliveryError(response.status >= 500 || response.status === 409);
  try {
    const data: { id?: unknown } = await response.json();
    if (typeof data.id === "string" && data.id) return data.id;
  } catch { /* The provider may have accepted the email even if the response was lost. */ }
  throw new FeedbackDeliveryError(true);
}
