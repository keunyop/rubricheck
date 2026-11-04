import assert from "node:assert/strict";
import { mock, test } from "node:test";

let reads = 0, failing = false;
mock.module("@upstash/redis", { namedExports: { Redis: class {
  async scan() { reads++; if (failing) throw new Error("offline"); return ["0", []]; }
} } });
const { getAdminQuizMetrics } = await import("./adminQuizMetrics.ts");

test("concurrent dashboard visits share numeric snapshots and a failed scan is retryable", async () => {
  const previous = { ...process.env };
  process.env.UPSTASH_REDIS_REST_URL = "https://test.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-cache";
  try {
    const [first, second] = await Promise.all([getAdminQuizMetrics(), getAdminQuizMetrics()]);
    assert.deepEqual(first, second); assert.equal(reads, 1);
    await getAdminQuizMetrics(); assert.equal(reads, 1);
    await getAdminQuizMetrics(true); assert.equal(reads, 2);
    process.env.UPSTASH_REDIS_REST_TOKEN = "other-store";
    failing = true;
    await assert.rejects(getAdminQuizMetrics(), /offline/);
    failing = false;
    assert.equal((await getAdminQuizMetrics()).coverage, "complete");
    assert.equal(reads, 4);
  } finally { process.env = previous; }
});
