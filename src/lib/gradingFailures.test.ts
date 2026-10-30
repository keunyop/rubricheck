import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { GradingFailureInput } from "./gradingFailures.ts";

const hashes = new Map<string, Map<string, string>>();
const sorted = new Map<string, Map<string, number>>();
const expires = new Map<string, number>();
const counts = new Map<string, number>();
let failChunks = false;
function purge(key: string) {
  if ((expires.get(key) ?? Infinity) <= Date.now()) { hashes.delete(key); sorted.delete(key); counts.delete(key); expires.delete(key); }
}
class MemoryRedis {
  async eval(script: string, keys: string[], args: Array<string | number>) {
    keys.forEach(purge);
    if (script.includes("failure:limit")) {
      const count = (counts.get(keys[0]) ?? 0) + 1; counts.set(keys[0], count);
      if (count === 1) expires.set(keys[0], Date.now() + 3600000);
      return count <= 5 ? 1 : 0;
    }
    if (script.includes("failure:init")) {
      assert.match(script, /EXPIREAT/);
      hashes.set(keys[0], new Map([["pending", "1"]])); expires.set(keys[0], Number(args[0]) * 1000); return 1;
    }
    if (script.includes("failure:chunks")) {
      if (failChunks) throw new Error("Storage unavailable");
      if (!hashes.has(keys[0])) return 0;
      for (let i = 0; i < args.length; i += 2) hashes.get(keys[0])!.set(String(args[i]), String(args[i + 1]));
      return 1;
    }
    if (script.includes("failure:commit")) {
      if (!hashes.has(keys[0])) return 0;
      hashes.get(keys[0])!.set("manifest", String(args[0])); hashes.get(keys[0])!.delete("pending");
      for (const key of keys.slice(1)) {
        await this.zremrangebyscore(key, "-inf", Number(args[4]));
        if (!sorted.has(key)) sorted.set(key, new Map());
        sorted.get(key)!.set(String(args[1]), Number(args[2])); expires.set(key, Date.now() + Number(args[3]) * 1000);
      }
      return 1;
    }
    if (script.includes("failure:delete")) {
      hashes.delete(keys[0]); expires.delete(keys[0]);
      keys.slice(1).forEach(key => sorted.get(key)?.delete(String(args[0]))); return 1;
    }
    throw new Error("Unknown script");
  }
  async hget(key: string, field: string) { purge(key); return hashes.get(key)?.get(field) ?? null; }
  async zrange(key: string, start: number, end: number, options?: { rev: boolean }) {
    purge(key);
    const rows = [...(sorted.get(key)?.entries() ?? [])].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (options?.rev) rows.reverse();
    return rows.slice(start, end === -1 ? undefined : end + 1).map(row => row[0]);
  }
  async zremrangebyscore(key: string, _min: unknown, max: number) {
    purge(key); for (const [id, time] of sorted.get(key) ?? []) if (time <= max) sorted.get(key)!.delete(id);
  }
  async del(key: string) { hashes.delete(key); sorted.delete(key); expires.delete(key); return 1; }
}
mock.module("@upstash/redis", { namedExports: { Redis: MemoryRedis } });
const { saveGradingFailure, listGradingFailures, getGradingFailure, deleteGradingFailure, deleteGradingFailuresForAccount } = await import("./gradingFailures.ts");

test("failure archives protect exact originals, expire, paginate and support early deletion", async t => {
  const previousEnv = { ...process.env };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-secret";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  const originalText = "  Private original assignment\r\nunchanged.\n";
  const bytes = new Uint8Array(320000).map((_, i) => i % 256);
  const input: GradingFailureInput = {
    requestId: "request-test", stage: "rubric_structuring", code: "RUBRIC_STRUCTURE_FAILED",
    accountEmail: "student@example.com", clientIp: "192.0.2.123", mode: "standard", language: "en",
    inputs: { rubricSource: "provided", rubricId: null, rubricText: "Original rubric", assignmentText: originalText, assignmentInstructions: "", extractedRubricText: "Original rubric", extractedAssignmentText: originalText.trim() },
    files: [{ field: "assignment", file: new File([bytes], "private-assignment.pdf", { type: "application/pdf" }) }],
  };
  try {
    const before = Date.now();
    const id = (await saveGradingFailure(input))!;
    const record = (await getGradingFailure(id))!;
    assert.equal(record.inputs.assignmentText, originalText);
    assert.deepEqual(Buffer.from(record.fileContents[0], "base64"), Buffer.from(bytes));
    assert.equal(record.files[0].name, "private-assignment.pdf");
    assert.equal(record.captureStatus, "complete");
    assert.equal(record.expiresAt - record.createdAt, 7 * 86400000);
    assert.ok(record.createdAt >= before);
    const raw = JSON.stringify([...hashes.entries()].map(([key, value]) => [key, [...value]]));
    for (const secret of [originalText, input.accountEmail!, input.clientIp, input.files[0].file.name]) assert.ok(!raw.includes(secret));
    assert.ok(!JSON.stringify([...counts.keys()]).includes(input.clientIp));
    const recordEntry = [...hashes.entries()].find(([key]) => key.endsWith(id))!;
    assert.ok(recordEntry[1].size > 2, "large originals use multiple chunks");
    assert.equal(expires.get(recordEntry[0]), Math.floor(record.expiresAt / 1000) * 1000);
    const page = await listGradingFailures();
    assert.equal(page.items[0].id, id);
    assert.ok(!("inputs" in page.items[0]));

    await t.test("tampering cannot expose unauthenticated plaintext", async () => {
      const chunk = recordEntry[1].get("c:0")!;
      recordEntry[1].set("c:0", (chunk[0] === "A" ? "B" : "A") + chunk.slice(1));
      await assert.rejects(getGradingFailure(id));
      recordEntry[1].set("c:0", chunk);
    });
    await t.test("collection limits keep metadata but omit excess originals", async () => {
      for (let i = 0; i < 4; i++) await saveGradingFailure({ ...input, files: [] });
      const limited = (await getGradingFailure((await saveGradingFailure(input))!))!;
      assert.equal(limited.captureStatus, "metadata_only");
      assert.equal(limited.inputs.assignmentText, null);
      assert.deepEqual(limited.fileContents, []);
      assert.match(limited.captureNote!, /five-originals/);
      const oversized = (await getGradingFailure((await saveGradingFailure({ ...input, accountEmail: "large@example.com", files: [{ field: "assignment", file: { size: 65 * 1024 * 1024, name: "large.pdf", type: "application/pdf", arrayBuffer: () => { throw new Error("Must not read oversized files"); } } as unknown as File }] }))!))!;
      assert.equal(oversized.captureStatus, "metadata_only");
      assert.match(oversized.captureNote!, /64 MiB/);
    });
    await t.test("pagination returns metadata only, without duplicates", async () => {
      for (let i = 0; i < 25; i++) await saveGradingFailure({ ...input, accountEmail: `user${i}@example.com`, files: [] });
      const first = await listGradingFailures(), second = await listGradingFailures(first.nextOffset!);
      assert.equal(first.items.length, 25);
      assert.equal(second.items.length, 7);
      assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 32);
    });
    await t.test("failed writes are not published and partial records are removed", async () => {
      const count = hashes.size;
      failChunks = true;
      await assert.rejects(saveGradingFailure({ ...input, accountEmail: "failed@example.com", files: [] }));
      failChunks = false;
      assert.equal(hashes.size, count);
    });
    await t.test("manual and account deletion remove originals and index entries", async () => {
      await deleteGradingFailure(id);
      assert.equal(await getGradingFailure(id), null);
      await deleteGradingFailuresForAccount("STUDENT@example.com");
      assert.ok(!(await listGradingFailures()).items.some(item => item.accountEmail === "student@example.com"));
      assert.ok([...hashes.keys()].every(key => !key.endsWith(id)));
    });
    await t.test("records and originals become unavailable after seven days", async () => {
      const clock = t.mock.method(Date, "now", () => record.expiresAt + 10000);
      assert.deepEqual((await listGradingFailures()).items, []);
      for (const key of [...hashes.keys()]) {
        assert.equal(await getGradingFailure(key.split(":").at(-1)!), null);
      }
      assert.equal(hashes.size, 0);
      clock.mock.restore();
    });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});
