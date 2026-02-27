import { Redis } from "@upstash/redis";

import { callSupabaseRpc, hasSupabaseConfig } from "./supabaseRest";

const PROCESSED_KEY_PREFIX = "rubricheck:stripe:webhook:processed:";
const FAILURE_KEY_PREFIX = "rubricheck:stripe:webhook:failure:";
const PROCESSED_TTL_SECONDS = 60 * 60 * 24 * 30;
const BILLING_SCOPE_WEBHOOK_EVENT = "webhook_event";

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

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

async function markProcessedSupabase(eventId: string): Promise<boolean> {
  const raw = await callSupabaseRpc<boolean>("rubricheck_mark_billing_event_processed", {
    p_scope: BILLING_SCOPE_WEBHOOK_EVENT,
    p_external_id: eventId.trim(),
  });
  return parseBoolean(raw);
}

export async function markWebhookEventProcessed(eventId: string): Promise<boolean> {
  const normalized = eventId.trim();
  if (!normalized) {
    return false;
  }

  if (hasSupabaseConfig()) {
    return markProcessedSupabase(normalized);
  }

  if (!hasRedisConfig()) {
    return false;
  }

  const result = await getRedisClient().set(`${PROCESSED_KEY_PREFIX}${normalized}`, "1", {
    nx: true,
    ex: PROCESSED_TTL_SECONDS,
  });

  return result === "OK";
}

async function persistFailureSupabase(params: {
  eventId: string;
  eventType: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  sessionId?: string | null;
  requestId: string;
  errorMessage: string;
}): Promise<void> {
  await callSupabaseRpc<null>("rubricheck_log_webhook_failure", {
    p_event_id: params.eventId,
    p_event_type: params.eventType,
    p_customer_id: params.customerId ?? null,
    p_subscription_id: params.subscriptionId ?? null,
    p_session_id: params.sessionId ?? null,
    p_request_id: params.requestId,
    p_error_message: params.errorMessage,
  });
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
  if (hasSupabaseConfig()) {
    await persistFailureSupabase(params);
    return;
  }

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
