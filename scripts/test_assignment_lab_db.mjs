import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
const connection = process.env.LAB_TEST_DATABASE_URL ?? "postgresql://lab_test@127.0.0.1:55439/postgres";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(connection).hostname)) throw new Error("Use a disposable LOCAL database for this test.");
const psql = process.env.PSQL_PATH ?? "psql";
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
async function sql(query, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, [connection, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", ...(file ? ["-f", file] : ["-c", query])], { windowsHide: true });
    let output = "", error = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { error += data; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
  });
}
await sql("", "supabase/assignment_lab.sql");
await sql("", "supabase/assignment_lab.test.sql");
const identity = createHash("sha256").update(randomUUID()).digest("hex");
const owner = await sql("select lab_resolve_user(" + quote(identity) + ")");
let assignment;
try {
  const ids = Array.from({ length: 8 }, () => randomUUID());
  const created = await Promise.allSettled(ids.map(id => sql("select lab_create_assignment(" + [owner,id,"Concurrent essay","Rubric","Draft","standard"].map(quote).join(",") + ",false)")));
  assert.equal(created.filter(r => r.status === "fulfilled").length, 1, "parallel free creates must enforce the one-assignment cap");
  for (const failure of created.filter(r => r.status === "rejected")) assert.match(failure.reason.message, /LAB_ASSIGNMENT_LIMIT/);
  assignment = created.find(r => r.status === "fulfilled").value;
  const rubricId = await sql("select id from lab_rubric_versions where assignment_id=" + quote(assignment));
  const cond = JSON.stringify({ rubricVersionId: rubricId, mode: "standard", structureModel: "test" });
  for (let version = 1; version <= 2; version++) {
    const tokens = Array.from({ length: 8 }, () => randomUUID());
    const hash = "v" + version;
    const reserved = await Promise.allSettled(tokens.map(token => sql("select lab_begin_run(" + [owner, assignment, hash, token].map(quote).join(",") + ",false)")));
    assert.equal(reserved.filter(r => r.status === "fulfilled").length, 1, "only one in-flight version may run");
    for (const failure of reserved.filter(r => r.status === "rejected")) assert.match(failure.reason.message, /LAB_PENDING/);
    const token = tokens[reserved.findIndex(r => r.status === "fulfilled")];
    const finish = "select lab_finish_run(" + [owner,assignment,token,hash,"Draft " + version,cond,"{}",'{"criteria":[]}',"[]"].map(quote).join(",") + ")";
    const commits = await Promise.all(Array.from({ length: 8 }, () => sql(finish)));
    assert.equal(new Set(commits).size, 1, "duplicate commits must return the same version ID");
  }
  assert.equal(await sql("select count(*) from lab_evaluation_runs where assignment_id=" + quote(assignment)), "2");
  await assert.rejects(() => sql("select lab_begin_run(" + [owner,assignment,"v3",randomUUID()].map(quote).join(",") + ",false)"), /LAB_VERSION_LIMIT/);
  const reused = await Promise.all(Array.from({ length: 8 }, () => sql("select lab_begin_run(" + [owner,assignment,"v1",randomUUID()].map(quote).join(",") + ",false)")));
  assert.ok(reused.every(value => JSON.parse(value).reused));
  const stale = randomUUID(), fresh = randomUUID();
  await sql("select lab_begin_run(" + [owner,assignment,"v3",stale].map(quote).join(",") + ",true)");
  await sql("update lab_assignments set lease_until=now()-interval '1 minute' where id=" + quote(assignment));
  await sql("select lab_begin_run(" + [owner,assignment,"v3",fresh].map(quote).join(",") + ",true)");
  await sql("select lab_release_run(" + [owner,assignment,stale].map(quote).join(",") + ")");
  assert.equal(await sql("select lease_token from lab_assignments where id=" + quote(assignment)), fresh);
  await sql("select lab_delete_assignment(" + [owner,assignment].map(quote).join(",") + ")");
  await assert.rejects(() => sql("select lab_finish_run(" + [owner,assignment,fresh,"v3","Draft3",cond,"{}","{}","[]"].map(quote).join(",") + ")"), /LAB_NOT_FOUND/);
  console.log("PASS: SQL invariants plus 8 concurrent creates, reservations, commits and cache hits; expired lease replacement and delete-during-evaluation.");
} finally {
  await sql("delete from lab_users where id=" + quote(owner));
}

