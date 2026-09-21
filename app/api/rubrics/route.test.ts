import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";

// Redis protocol boundary, including automatic JSON decoding and atomic scripts.
const hashes = new Map<string, Map<string, string>>();
const ttls = new Map<string, number>();
let offline = false, failChunk = false;
const hash = (key: string) => { if (!hashes.has(key)) hashes.set(key, new Map()); return hashes.get(key)!; };
const encode = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value);
const decode = (value: string | undefined) => { if (value === undefined) return null; try { return JSON.parse(value); } catch { return value; } };
class Redis {
  check() { if (offline) throw Error("offline"); }
  async hget(key: string, field: string) { this.check(); return decode(hash(key).get(field)); }
  async hgetall(key: string) { this.check(); return Object.fromEntries([...hash(key)].map(([field, value]) => [field, decode(value)])); }
  async hset(key: string, value: { [key: string]: unknown }) {
    this.check();
    if (failChunk) throw Error("upload failed");
    for (const [field, content] of Object.entries(value)) hash(key).set(field, encode(content));
    return 1;
  }
  async del(key: string) { this.check(); hashes.delete(key); ttls.delete(key); return 1; }
  async eval(script: string, keys: string[], args: unknown[]) {
    this.check();
    if (script.includes("'EXPIRE'")) {
      hash(keys[0]).set("record", String(args[0])); ttls.set(keys[0], 3600); return 1;
    }
    const entries = hash(keys[0]);
    const id = String(args[0]);
    if (keys.length === 3) {
      const item = JSON.parse(String(args[1]));
      const existing = decode(entries.get(id));
      if (existing) { existing.lastUsedAt = item.lastUsedAt; entries.set(id, JSON.stringify(existing)); hashes.delete(keys[1]); }
      else {
        assert.ok(hashes.has(keys[1]), "staged record exists before commit");
        hashes.set(keys[2], hash(keys[1])); hashes.delete(keys[1]); ttls.delete(keys[2]); entries.set(id, String(args[1]));
      }
      while (entries.size > Number(args[2])) {
        const oldest = [...entries].filter(([key]) => key !== id).sort((a, b) => JSON.parse(a[1]).lastUsedAt - JSON.parse(b[1]).lastUsedAt)[0][0];
        entries.delete(oldest); hashes.delete(keys[0] + ":data:" + oldest);
      }
      return 1;
    }
    const item = decode(entries.get(id));
    if (!item) return 0;
    if (args[1] === "delete") { entries.delete(id); hashes.delete(keys[1]); return 1; }
    if (args[1] === "rename") item.name = args[2]; else item.lastUsedAt = args[3];
    entries.set(id, JSON.stringify(item)); return 1;
  }
}
mock.module("@upstash/redis", { namedExports: { Redis } });
const { saveRubric, getSavedRubric, listRubrics, rubricLibraryKey } = await import("../../../src/lib/rubricLibrary.ts");
const { GET, POST } = await import("./route.ts");
const rubric = { criteria: [{ name: "Focus", max_score: 50, description: "Focus" }, { name: "Support", max_score: 50, description: "Evidence" }] };
const owner = "student@example.com", other = "other@example.com";
function request(email?: string, query = "", body?: object) {
  return new Request("https://example.com/api/rubrics" + query, {
    method: body ? "POST" : "GET",
    headers: email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }), "content-type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("rubric library retains originals, isolates accounts, and handles failed writes", async t => {
  const oldEnv = { ...process.env };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  try {
    await t.test("anonymous and malformed requests never access private content", async () => {
      assert.equal((await GET(request())).status, 401);
      assert.equal((await POST(request(undefined, "", { action: "rename" }))).status, 401);
      assert.equal((await GET(request(owner, "?id=../../other"))).status, 400);
      for (const name of [" ", "x".repeat(81)]) {
        assert.equal((await POST(request(owner, "", { action: "rename", id: "a".repeat(64), name }))).status, 400);
      }
    });
    const original = Buffer.alloc(410000, 0xab); original.write("Original rubric");
    const file = new File([original], "평가 기준.pdf", { type: "application/pdf" });
    const id = await saveRubric(owner, "Focus and supporting evidence", rubric, [file]);
    await t.test("list stays lightweight and source download returns the original bytes and Unicode name", async () => {
      const response = await GET(request(owner));
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const items = (await response.json()).rubrics;
      assert.equal(items.length, 1); assert.equal(items[0].files[0].name, file.name);
      assert.equal(items[0].text, undefined); assert.equal(items[0].rubric, undefined); assert.equal(items[0].chunks, undefined);
      const downloaded = await GET(request(owner, "?id=" + id + "&file=0"));
      assert.equal(downloaded.status, 200);
      assert.equal(downloaded.headers.get("x-content-type-options"), "nosniff");
      assert.match(downloaded.headers.get("content-disposition")!, /filename\*=UTF-8''/);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), original);
      const detail = (await (await GET(request(owner, "?id=" + id))).json()).rubric;
      assert.equal(detail.text, "Focus and supporting evidence"); assert.equal(detail.chunks, undefined);
      assert.equal(ttls.has(rubricLibraryKey(owner) + ":data:" + id), false, "library is independent of seven-day cache TTL");
    });
    await t.test("other accounts cannot list, read, rename, remove or download a rubric", async () => {
      assert.deepEqual((await (await GET(request(other))).json()).rubrics, []);
      for (const query of ["?id=" + id, "?id=" + id + "&file=0"]) assert.equal((await GET(request(other, query))).status, 404);
      for (const action of ["rename", "delete"]) assert.equal((await POST(request(other, "", { action, id, name: "Stolen" }))).status, 404);
    });
    await t.test("rename survives repeated and concurrent reuse; recency updates", async () => {
      assert.equal((await POST(request(owner, "", { action: "rename", id, name: "  Essay rubric  " }))).status, 200);
      const [first, second] = await Promise.all([saveRubric(owner, "Focus and supporting evidence", rubric, [file]), saveRubric(owner, "Focus and supporting evidence", rubric, [file])]);
      assert.equal(first, id); assert.equal(second, id);
      assert.equal((await listRubrics(owner)).length, 1);
      assert.equal((await getSavedRubric(owner, id))!.name, "Essay rubric");
      const sameBytesDifferentName = new File([original], "other.pdf", { type: "application/pdf" });
      assert.notEqual(await saveRubric(owner, "Focus and supporting evidence", rubric, [sameBytesDifferentName]), id);
    });
    await t.test("numeric-looking base64 and multi-file uploads preserve exact bytes", async () => {
      const bytes = Buffer.from("1234", "base64");
      const files = [new File([bytes], "1.png"), new File([Buffer.from([0, 1, 255, 22])], "2.jpg")];
      const imagesId = await saveRubric(owner, "Image rubric", rubric, files);
      for (let index = 0; index < files.length; index++) {
        const response = await GET(request(owner, "?id=" + imagesId + "&file=" + index));
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(await files[index].arrayBuffer()));
      }
      for (const index of ["-1", "abc", "99"]) assert.ok([400, 404].includes((await GET(request(owner, "?id=" + imagesId + "&file=" + index))).status));
    });
    await t.test("partial upload failure leaves no visible or permanent record", async () => {
      const before = await listRubrics(owner);
      failChunk = true;
      await assert.rejects(saveRubric(owner, "Failed upload", rubric, [file]));
      failChunk = false;
      assert.deepEqual(await listRubrics(owner), before);
      assert.ok(![...hashes.keys()].some(key => key.includes(":pending:")));
    });
    await t.test("removal deletes both listing and original data", async () => {
      assert.equal((await POST(request(owner, "", { action: "delete", id }))).status, 200);
      assert.equal((await GET(request(owner, "?id=" + id))).status, 404);
      assert.equal((await GET(request(owner, "?id=" + id + "&file=0"))).status, 404);
      assert.ok(!hashes.get(rubricLibraryKey(owner) + ":data:" + id)?.size);
    });
    await t.test("oldest entries and their originals are pruned at the library limit", async () => {
      hashes.clear();
      const first = await saveRubric(owner, "First rubric", rubric, [file]);
      for (let i = 1; i <= 50; i++) await saveRubric(owner, "Text rubric " + i, rubric, []);
      assert.equal((await listRubrics(owner)).length, 50);
      assert.equal(await getSavedRubric(owner, first), null);
      assert.ok(!hashes.get(rubricLibraryKey(owner) + ":data:" + first)?.size);
    });
    await t.test("empty file arrays remain arrays after Redis Lua metadata edits", async () => {
      const id = await saveRubric(owner, "Text only rubric", rubric, []);
      const raw = JSON.parse(hash(rubricLibraryKey(owner)).get(id)!);
      hash(rubricLibraryKey(owner)).set(id, JSON.stringify({ ...raw, files: {} }));
      assert.deepEqual((await getSavedRubric(owner, id))!.files, []);
      assert.deepEqual((await listRubrics(owner)).find(item => item.id === id)!.files, []);
    });
    await t.test("storage outages return retryable errors", async () => {
      offline = true;
      assert.equal((await GET(request(owner))).status, 503);
      assert.equal((await POST(request(owner, "", { action: "rename", id, name: "Retry" }))).status, 503);
      offline = false;
    });
  } finally { process.env = oldEnv; }
});
