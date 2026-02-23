import { Redis } from "@upstash/redis";

const PROCESSED_KEY_PREFIX = "rubricheck:stripe:webhook:processed:";
const FAILURE_KEY_PREFIX = "rubricheck:stripe:webhook:failure:";
const PROCESSED_TTL_SECONDS = 60 * 60 * 24 * 30;

let redisClient: Redis | null = null;

function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
}

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_CONFIG_MISSING");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function markWebhookEventProcessed(eventId: string): Promise<boolean> {
  if (!hasRedisConfig()) {
    return false;
  }

  const normalized = eventId.trim();
  if (!normalized) {
    return false;
  }

  const result = await getRedisClient().set(`${PROCESSED_KEY_PREFIX}${normalized}`, "1", {
    nx: true,
    ex: PROCESSED_TTL_SECONDS,
  });

  return result === "OK";
}

export async function persistWebhookFailure(params: {
  eventId: string;
  eventType: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  sessionId?: string | null;
  requestId: string;
  errorMessage: string;
}): Promise<void> {
  if (!hasRedisConfig()) {
    return;
  }

  const normalized = params.eventId.trim();
  if (!normalized) {
    return;
  }

  await getRedisClient().set(`${FAILURE_KEY_PREFIX}${normalized}`, {
    eventId: normalized,
    eventType: params.eventType,
    customerId: params.customerId ?? null,
    subscriptionId: params.subscriptionId ?? null,
    sessionId: params.sessionId ?? null,
    requestId: params.requestId,
    errorMessage: params.errorMessage,
    failedAt: new Date().toISOString(),
  });
}
