import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { z } from "zod";
import { MAX_FEEDBACK_LENGTH, type ProductFeedback, type FeedbackPage } from "./productFeedbackTypes";

export const feedbackSchema = z.object({
  category: z.enum(["issue", "idea", "other"]),
  message: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  replyEmail: z.union([z.literal(""), z.string().trim().email().max(254)]).optional(),
  page: z.string().max(200).regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).default("/"),
});
const INBOX_KEY = "rubricheck:{feedback}:inbox";
const PAGE_SIZE = 25;
function feedbackRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("FEEDBACK_STORE_UNAVAILABLE");
  return new Redis({ url, token });
}

export async function submitFeedback(input: z.infer<typeof feedbackSchema>, accountEmail: string | null, ip: string) {
  const item: ProductFeedback = {
    id: randomUUID(), ...input, replyEmail: input.replyEmail || null, accountEmail,
    createdAt: new Date().toISOString(),
  };
  const actor = accountEmail ? "account:" + accountEmail : "ip:" + ip;
  const actorHash = createHash("sha256").update(actor).digest("hex");
  // Limit and insert together so a failed write cannot be reported as a success.
  const saved = await feedbackRedis().eval<unknown[], number>(
    `local count = tonumber(redis.call('GET', KEYS[2]) or '0')
    if count >= tonumber(ARGV[2]) then return 0 end
    redis.call('LPUSH', KEYS[1], ARGV[1])
    redis.call('INCR', KEYS[2])
    if count == 0 then redis.call('EXPIRE', KEYS[2], ARGV[3]) end
    return 1`,
    [INBOX_KEY, "rubricheck:{feedback}:limit:" + actorHash],
    [JSON.stringify(item), 5, 3600],
  );
  return Boolean(saved);
}

export async function listFeedback(offset: number): Promise<FeedbackPage> {
  const items = await feedbackRedis().lrange<ProductFeedback>(INBOX_KEY, offset, offset + PAGE_SIZE);
  return { items: items.slice(0, PAGE_SIZE), nextOffset: items.length > PAGE_SIZE ? offset + PAGE_SIZE : null };
}
