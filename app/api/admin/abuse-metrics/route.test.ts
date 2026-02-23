import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "./route";

test("admin abuse metrics endpoint requires ADMIN_SECRET", async () => {
  const previous = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = "top-secret";

  try {
    const unauthorizedResponse = await GET(new Request("http://localhost/api/admin/abuse-metrics"));
    assert.equal(unauthorizedResponse.status, 401);

    const authorizedResponse = await GET(
      new Request("http://localhost/api/admin/abuse-metrics", {
        headers: {
          "x-admin-secret": "top-secret",
        },
      }),
    );

    assert.equal(authorizedResponse.status, 200);
  } finally {
    process.env.ADMIN_SECRET = previous;
  }
});
