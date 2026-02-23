import assert from "node:assert/strict";
import test from "node:test";

import { checkRedisFallbackAllowance } from "./usageLimit.ts";

function buildRequest(ip: string): Request {
  return new Request("https://example.test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

test("redis fallback allows limited usage per IP", () => {
  const request = buildRequest("203.0.113.1");

  const first = checkRedisFallbackAllowance(request, "evaluate");
  const second = checkRedisFallbackAllowance(request, "evaluate");
  const third = checkRedisFallbackAllowance(request, "evaluate");

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(first.limit, 2);
});
