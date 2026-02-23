import assert from "node:assert/strict";
import test from "node:test";

import { errorResponse } from "./apiError.ts";

test("errorResponse uses consistent schema", async () => {
  const response = errorResponse(
    { requestId: "req_123" },
    504,
    "OPENAI_TIMEOUT",
    "Please retry shortly.",
    { foo: "bar" },
  );

  assert.equal(response.status, 504);
  assert.equal(response.headers.get("x-request-id"), "req_123");
  const body = (await response.json()) as Record<string, unknown>;
  assert.deepEqual(body, {
    code: "OPENAI_TIMEOUT",
    message: "Please retry shortly.",
    requestId: "req_123",
    details: { foo: "bar" },
  });
});
