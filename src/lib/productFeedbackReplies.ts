import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { feedbackRedis, feedbackRepliesKey, getFeedback } from "./productFeedback";
import { FeedbackDeliveryError, getFeedbackMailSettings, sendFeedbackEmail } from "./productFeedbackMail";
import { MAX_REPLY_LENGTH, MAX_REPLY_SUBJECT_LENGTH, type FeedbackReply } from "./productFeedbackTypes";

export const feedbackReplySchema = z.object({
  subject: z.string().trim().min(1).max(MAX_REPLY_SUBJECT_LENGTH).regex(/^[^\r\n]+$/),
  message: z.string().trim().min(1).max(MAX_REPLY_LENGTH),
}).strict();

export class FeedbackReplyError extends Error {
  readonly code: string;
  readonly reply?: FeedbackReply;
  constructor(code: string, reply?: FeedbackReply) { super(code); this.code = code; this.reply = reply; }
}

export async function replyToFeedback(id: string, input: z.infer<typeof feedbackReplySchema>, sentBy: string): Promise<FeedbackReply> {
  const feedback = await getFeedback(id);
  if (!feedback) throw new FeedbackReplyError("FEEDBACK_NOT_FOUND");
  const to = feedback.replyEmail || feedback.accountEmail;
  if (!to || !z.email().safeParse(to).success) throw new FeedbackReplyError("FEEDBACK_NO_RECIPIENT");
  const settings = getFeedbackMailSettings();
  if (!settings.ready || !settings.replyTo) throw new FeedbackReplyError("FEEDBACK_MAIL_NOT_CONFIGURED");

  // Identical replies share a permanent record, including across tabs and page refreshes.
  const replyId = createHash("sha256").update(JSON.stringify([id, input.subject, input.message])).digest("hex");
  const key = feedbackRepliesKey(id);
  const lockKey = key + ":lock:" + replyId;
  const lockToken = randomUUID();
  const now = new Date().toISOString();
  const candidate: FeedbackReply = {
    id: replyId, status: "pending", from: settings.from, to, replyTo: settings.replyTo,
    ...input, createdAt: now, attemptedAt: now, sentAt: null, sentBy, providerEmailId: null,
  };
  const redis = feedbackRedis();
  const [state, raw] = await redis.eval<unknown[], [number, string | FeedbackReply]>(
    `-- feedback-reply-claim
    local raw = redis.call('HGET', KEYS[1], ARGV[1])
    local reply = raw and cjson.decode(raw) or cjson.decode(ARGV[2])
    if reply.status == 'sent' then return {0, raw} end
    for _, otherRaw in ipairs(redis.call('HVALS', KEYS[1])) do
      local other = cjson.decode(otherRaw)
      if other.id ~= ARGV[1] and (other.status == 'pending' or other.status == 'unknown') then return {4, otherRaw} end
    end
    if raw and (reply.status == 'pending' or reply.status == 'unknown') and reply.attemptedAt <= ARGV[4] then return {3, raw} end
    if not redis.call('SET', KEYS[2], ARGV[3], 'NX', 'EX', 45) then return {2, raw or ''} end
    if reply.status == 'failed' then reply.attemptedAt = ARGV[5] end
    reply.status = 'pending'
    local saved = cjson.encode(reply)
    redis.call('HSET', KEYS[1], ARGV[1], saved)
    return {1, saved}`,
    [key, lockKey],
    [replyId, JSON.stringify(candidate), lockToken, new Date(Date.now() - 23 * 3600 * 1000).toISOString(), now],
  );
  if (state === 2) throw new FeedbackReplyError("FEEDBACK_REPLY_BUSY");
  if (state === 3) throw new FeedbackReplyError("FEEDBACK_REPLY_REVIEW_REQUIRED");
  const reply: FeedbackReply = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (state === 4) throw new FeedbackReplyError("FEEDBACK_UNRESOLVED_REPLY", reply);
  if (state === 0) return reply;

  let deliveryError: FeedbackDeliveryError | undefined;
  try {
    reply.providerEmailId = await sendFeedbackEmail(id, reply);
    reply.status = "sent";
    reply.sentAt = new Date().toISOString();
  } catch (error) {
    if (!(error instanceof FeedbackDeliveryError)) throw error;
    deliveryError = error;
    reply.status = error.uncertain ? "unknown" : "failed";
  }
  // Persist and release atomically; losing the write leaves a retriable pending record.
  const saved = await redis.eval<unknown[], number>(
    `-- feedback-reply-finish
    if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
    redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
    redis.call('DEL', KEYS[2])
    return 1`,
    [key, lockKey], [lockToken, replyId, JSON.stringify(reply)],
  );
  if (!saved) throw new FeedbackReplyError("FEEDBACK_REPLY_BUSY");
  if (deliveryError) throw new FeedbackReplyError(deliveryError.message, reply);
  return reply;
}
