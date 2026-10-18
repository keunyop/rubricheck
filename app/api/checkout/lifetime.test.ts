import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route.ts";

test("disabled lifetime checkout rejects direct API and legacy lookup-key requests", async () => {
  for (const body of [{ plan: "lifetime" }, { priceId: "pro_lifetime" }]) {
    const response = await POST(new Request("http://localhost/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "PLAN_UNAVAILABLE");
  }
});
