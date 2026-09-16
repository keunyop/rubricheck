import assert from "node:assert/strict";
import { test } from "node:test";
import { createCreditSessionToken, CREDIT_SESSION_COOKIE_NAME } from "../../../src/lib/creditSession.ts";
import { archiveAssignment, createProject, editWorkspace, getArchivedAssignment, listWorkspace, workspaceKey } from "../../../src/lib/assignmentWorkspace.ts";
import { assignmentTitle, projectVersions } from "../../../src/lib/assignmentWorkspaceTypes.ts";
import { ownerHash, type RecoverableResult } from "../../../src/lib/evaluationRecovery.ts";
import { GET, POST } from "./route.ts";
import { GET as readResult } from "./assignments/[id]/route.ts";

const first = "ae7f951b-1810-4f55-90c2-029899442ff1";
const second = "ae7f951b-1810-4f55-90c2-029899442ff2";
const result: RecoverableResult = {
  evaluation_id: first, title: "History essay", access_tier: "free", overall_range: [60, 70],
  summary: "Add evidence.", top_improvements: ["Public", "Locked second", "Locked third"],
  criteria: [{ name: "Evidence", max_score: 100, score: 65, rationale: "Add evidence.", estimated_range: [60, 70], feedback: "Add evidence.", detailed_breakdown: "Paid detail", example_revisions: ["Paid rewrite"] }],
};

test("workspace APIs isolate accounts, validate changes and retain result-only version history", async () => {
  const oldFetch = globalThis.fetch;
  const oldEnv = { ...process.env };
  process.env.ENTITLEMENT_SESSION_SECRET = "test-only";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.invalid";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-only";
  const hashes = new Map<string, Map<string, string>>();
  const values = new Map<string, string>();
  let calls = 0;
  function hash(key: string) { if (!hashes.has(key)) hashes.set(key, new Map()); return hashes.get(key)!; }
  function command(parts: unknown[]) {
    calls++;
    const [raw, key, ...args] = parts;
    const op = String(raw).toLowerCase();
    if (op === "hgetall") return [...hash(String(key)).entries()].flat();
    if (op === "hget") return hash(String(key)).get(String(args[0])) ?? null;
    if (op === "hset") { for (let i = 0; i < args.length; i += 2) hash(String(key)).set(String(args[i]), String(args[i + 1])); return 1; }
    if (op === "get") return values.get(String(key)) ?? null;
    if (op === "eval") {
      const count = Number(args[0]);
      const keys = args.slice(1, count + 1).map(String);
      const argv = args.slice(count + 1).map(String);
      const entries = hash(keys[0]);
      if (count === 2) {
        const item = JSON.parse(argv[1]);
        if (item.projectId && !entries.has("p:" + item.projectId)) item.projectId = null;
        if (!entries.has("a:" + argv[0])) entries.set("a:" + argv[0], JSON.stringify(item));
        values.set(keys[1], argv[2]);
        return 1;
      }
      const [action, id, value] = argv;
      const field = (action === "moveAssignment" ? "a:" : "p:") + id;
      if (!entries.has(field)) return 0;
      const item = JSON.parse(entries.get(field)!);
      if (action === "moveAssignment") {
        if (value && !entries.has("p:" + value)) return 0;
        item.projectId = value || null;
      } else if (action === "renameProject") item.name = value;
      else {
        for (const [field, raw] of entries) {
          const item = JSON.parse(raw);
          if (field.startsWith("a:") && item.projectId === id) entries.set(field, JSON.stringify({ ...item, projectId: null }));
        }
        entries.delete(field); return 1;
      }
      entries.set(field, JSON.stringify(item)); return 1;
    }
    throw new Error("Unexpected Redis command: " + op);
  }
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const payload = Array.isArray(body[0]) ? body.map((parts: unknown[]) => ({ result: command(parts) })) : { result: command(body) };
    return Response.json(payload);
  };
  function request(email?: string, body?: unknown) {
    return new Request("https://example.com/api/workspace", {
      method: body === undefined ? "GET" : "POST",
      headers: email ? { cookie: CREDIT_SESSION_COOKIE_NAME + "=" + createCreditSessionToken({ email }), "content-type": "application/json" } : {},
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  const owner = "owner@example.com", other = "other@example.com";
  try {
    assert.equal((await GET(request())).status, 401);
    assert.equal((await POST(request(undefined, { action: "createProject", name: "No" }))).status, 401);
    assert.equal((await readResult(request(), { params: Promise.resolve({ id: first }) })).status, 401);
    assert.equal(calls, 0);
    for (const body of [{ action: "createProject", name: " " }, { action: "createProject", name: "a".repeat(81) }, { action: "moveAssignment", id: "../bad", projectId: null }]) assert.equal((await POST(request(owner, body))).status, 400);
    assert.equal(calls, 0);

    const created = await POST(request(owner, { action: "createProject", name: "  Essay  " }));
    assert.equal(created.status, 200);
    const project = (await created.json()).project;
    assert.equal(project.name, "Essay");
    const otherProject = await createProject(other, "Private project");
    await archiveAssignment(owner, result, "standard", project.id);
    await archiveAssignment(owner, { ...result, evaluation_id: second, title: "Revised essay", overall_range: [75, 85] }, "strict", project.id);
    const history = await listWorkspace(owner);
    assert.equal(history.assignments.length, 2);
    assert.equal(history.projects.length, 1);
    assert.equal(projectVersions(history.assignments, project.id).length, 2);
    assert.deepEqual((await listWorkspace(other)).assignments, []);
    assert.equal(await getArchivedAssignment(other, first), null);
    assert.equal((await readResult(request(other), { params: Promise.resolve({ id: first }) })).status, 404);
    assert.equal((await POST(request(other, { action: "renameProject", id: project.id, name: "Intrusion" }))).status, 404);
    assert.equal((await POST(request(owner, { action: "moveAssignment", id: first, projectId: otherProject.id }))).status, 404);
    assert.equal((await POST(request(other, { action: "deleteProject", id: project.id }))).status, 404);

    const response = await readResult(request(owner), { params: Promise.resolve({ id: first }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.deepEqual(data.result.top_improvements, ["Public"]);
    assert.equal(data.result.criteria[0].detailed_breakdown, undefined);
    assert.equal(data.owner, undefined);
    assert.equal(data.assignmentText, undefined);
    assert.equal(data.rubric, undefined);
    assert.equal(JSON.stringify(await listWorkspace(owner)).includes("Paid detail"), false);

    // A second device sees the same server history; retries preserve version dates and membership.
    const createdAt = history.assignments.find(item => item.id === first)!.createdAt;
    await archiveAssignment(owner, { ...result, access_tier: "topup" }, "standard");
    const reloaded = await (await GET(request(owner))).json();
    assert.equal(reloaded.assignments.length, 2);
    assert.equal(reloaded.assignments.find((item: { id: string }) => item.id === first).createdAt, createdAt);
    assert.equal(reloaded.assignments.find((item: { id: string }) => item.id === first).projectId, project.id);
    assert.equal((await getArchivedAssignment(owner, first))!.result.access_tier, "topup");
    assert.equal(workspaceKey(" OWNER@example.com "), workspaceKey(owner));
    assert.notEqual(workspaceKey(owner), workspaceKey(other));
    assert.equal(values.get(workspaceKey(owner) + ":result:" + first)?.includes('"owner":"' + ownerHash(owner) + '"'), true);

    await editWorkspace(owner, "renameProject", project.id, "Final essay");
    assert.equal((await listWorkspace(owner)).projects[0].name, "Final essay");
    await editWorkspace(owner, "moveAssignment", first, null);
    assert.equal((await listWorkspace(owner)).assignments.find(item => item.id === first)!.projectId, null);
    await editWorkspace(owner, "deleteProject", project.id, null);
    const deleted = await listWorkspace(owner);
    assert.equal(deleted.projects.length, 0);
    assert.equal(deleted.assignments.length, 2);
    assert.ok(deleted.assignments.every(item => item.projectId === null));
    assert.ok(await getArchivedAssignment(owner, second));
    const before = calls;
    assert.equal(await getArchivedAssignment(owner, "../invalid"), null);
    assert.equal(calls, before);
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of ["ENTITLEMENT_SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
      if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
    }
  }
});

test("history titles identify uploads and pasted drafts, and version order is stable", () => {
  assert.equal(assignmentTitle("Body", ["C:\\uploads\\History_Essay.docx"]), "History Essay");
  assert.equal(assignmentTitle("\n# Climate change report\nThe body of the essay", ["IMG_001.jpg"]), "Climate change report");
  assert.equal(assignmentTitle("  \n "), "Untitled assignment");
  assert.ok(assignmentTitle("A".repeat(200)).length <= 80);
  const common = { title: "Draft", projectId: "project", mode: "standard" as const, overallRange: [60, 70] as [number, number] };
  const versions = projectVersions([{ ...common, id: "b", createdAt: 2 }, { ...common, id: "a", createdAt: 1 }, { ...common, id: "c", projectId: null, createdAt: 0 }], "project");
  assert.deepEqual(versions.map(item => item.id), ["a", "b"]);
});
