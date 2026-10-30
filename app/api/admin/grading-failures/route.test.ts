import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../../src/lib/creditSession.ts";

const id = "11111111-1111-4111-8111-111111111111";
const bytes = Buffer.from([0, 1, 255, 42]);
let calls = 0, unavailable = false, missing = false;
const deleted: string[] = [];
const record = { id, files: [{ name: 'assignment".pdf', size: bytes.length, type: "text/html", field: "assignment" }], fileContents: [bytes.toString("base64")], inputs: { assignmentText: "private assignment" } };
mock.module("../../../../src/lib/gradingFailures.ts", { namedExports: {
  validFailureId: (value: string) => value === id,
  listGradingFailures: async (offset: number) => { calls++; if (unavailable) throw new Error("private storage failure"); return { items: [{ id }], nextOffset: offset === 0 ? 25 : null }; },
  getGradingFailure: async () => { calls++; return missing ? null : record; },
  deleteGradingFailure: async (id: string) => { calls++; deleted.push(id); },
  deleteGradingFailuresForAccount: async (email: string) => { calls++; deleted.push(email); },
} });
const { GET, DELETE } = await import("./route.ts");

test("only admins can read, download and delete diagnostic originals", async () => {
  const old = { ...process.env };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.ADMIN_SECRET = "admin-test";
  process.env.ADMIN_EMAILS = "admin@example.com";
  function request(query = "", headers: Record<string, string> = {}, body?: object) {
    return new Request("https://example.com/api/admin/grading-failures" + query, {
      method: body ? "DELETE" : "GET", headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const auth = { "x-admin-secret": "admin-test" };
  try {
    const unauthorized: Array<Record<string, string>> = [{}, { "x-admin-secret": "wrong" }, { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: "student@example.com" }) }];
    for (const headers of unauthorized) {
      assert.equal((await GET(request("", headers))).status, 401);
      assert.equal((await GET(request("?id=" + id + "&file=0", headers))).status, 401);
      assert.equal((await DELETE(request("", headers, { id }))).status, 401);
    }
    assert.equal(calls, 0);
    const response = await GET(request("", { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email: "admin@example.com" }) }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await response.json()).nextOffset, 25);
    for (const query of ["?offset=-1", "?offset=1.5", "?offset=NaN", "?id=bad"]) assert.equal((await GET(request(query, auth))).status, 400);
    const detail = await (await GET(request("?id=" + id, auth))).json();
    assert.equal(detail.inputs.assignmentText, "private assignment");
    assert.ok(!("fileContents" in detail));
    const download = await GET(request("?id=" + id + "&file=0", auth));
    assert.equal(download.headers.get("content-type"), "application/octet-stream");
    assert.equal(download.headers.get("x-content-type-options"), "nosniff");
    assert.match(download.headers.get("content-disposition")!, /^attachment;/);
    assert.ok(download.headers.get("content-disposition")!.includes("%22"));
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    for (const index of ["-1", "1", "0.5", "NaN"]) assert.equal((await GET(request(`?id=${id}&file=${index}`, auth))).status, 404);
    missing = true;
    assert.equal((await GET(request("?id=" + id, auth))).status, 404);
    missing = false;
    unavailable = true;
    const outage = await GET(request("", auth));
    assert.equal(outage.status, 503);
    assert.ok(!(await outage.text()).includes("private storage failure"));
    unavailable = false;
    const before = calls;
    assert.equal((await DELETE(request("", { ...auth, origin: "https://evil.example" }, { id }))).status, 403);
    assert.equal((await DELETE(request("", auth, { id: "bad" }))).status, 400);
    assert.equal((await DELETE(request("", auth, { id, email: "student@example.com" }))).status, 400);
    assert.equal(calls, before);
    assert.equal((await DELETE(request("", auth, { id }))).status, 200);
    assert.equal((await DELETE(request("", auth, { email: "student@example.com" }))).status, 200);
    assert.deepEqual(deleted, [id, "student@example.com"]);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key];
    Object.assign(process.env, old);
  }
});
