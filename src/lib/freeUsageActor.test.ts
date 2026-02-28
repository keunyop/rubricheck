import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { getFreeUsageActor } from "./freeUsageActor.ts";

function buildRequest(ip: string): Request {
  return new Request("https://example.test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

test("free usage actor falls back to IP when no session email exists", () => {
  const request = buildRequest("203.0.113.9");

  assert.equal(getFreeUsageActor(request), "ip:203.0.113.9");
});

test("free usage actor prefers signed-in email when session cookie exists", () => {
  const previousSecret = process.env.ENTITLEMENT_SESSION_SECRET;
  process.env.ENTITLEMENT_SESSION_SECRET = "test-secret";

  try {
    const payload = Buffer.from(
      JSON.stringify({
        email: "student@example.com",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", "test-secret").update(payload).digest("base64url");
    const request = new Request("https://example.test", {
      headers: {
        cookie: `rubricheck_credit_session=${payload}.${signature}`,
        "x-forwarded-for": "203.0.113.9",
      },
    });

    assert.equal(getFreeUsageActor(request), "email:student@example.com");
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ENTITLEMENT_SESSION_SECRET;
    } else {
      process.env.ENTITLEMENT_SESSION_SECRET = previousSecret;
    }
  }
});
