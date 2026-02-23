import assert from "node:assert/strict";
import test from "node:test";

import { markWebhookEventProcessed } from "./stripeWebhookEvents.ts";

test("webhook idempotency helper returns false when redis unavailable", async () => {
  const priorUrl = process.env.UPSTASH_REDIS_REST_URL;
  const priorToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const first = await markWebhookEventProcessed("evt_123");
    const second = await markWebhookEventProcessed("evt_123");
    assert.equal(first, false);
    assert.equal(second, false);
  } finally {
    if (priorUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = priorUrl;
    }

    if (priorToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = priorToken;
    }
  }
});
