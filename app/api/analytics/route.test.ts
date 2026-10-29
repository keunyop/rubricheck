import assert from "node:assert/strict";
import test from "node:test";
import { DELETE } from "./route.ts";

test("opting out persists a refusal and clears the visitor even when analytics storage is disabled", async () => {
  const previous = process.env.GROWTH_ANALYTICS_ENABLED;
  process.env.GROWTH_ANALYTICS_ENABLED = "false";
  try {
    const response = await DELETE(new Request("https://rubricheck.com/api/analytics", { method: "DELETE", headers: { origin: "https://rubricheck.com" } }));
    assert.equal(response.status, 204);
    assert.equal(response.cookies.get("rubricheck_analytics")?.value, "denied");
    assert.equal(response.cookies.get("rubricheck_growth")?.value, "");
    const blocked = await DELETE(new Request("https://rubricheck.com/api/analytics", { method: "DELETE", headers: { origin: "https://other.example" } }));
    assert.equal(blocked.status, 403);
    assert.equal(blocked.cookies.get("rubricheck_analytics"), undefined);
  } finally {
    if (previous === undefined) delete process.env.GROWTH_ANALYTICS_ENABLED;
    else process.env.GROWTH_ANALYTICS_ENABLED = previous;
  }
});
