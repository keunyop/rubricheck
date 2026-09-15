// Run only against a disposable local database with both schema files applied.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
const port = process.env.PGPORT;
if (!port || !["127.0.0.1", "localhost"].includes(process.env.PGHOST)) {
  throw new Error("Set PGHOST=127.0.0.1 and PGPORT to a disposable local PostgreSQL instance.");
}
function query(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PSQL_BIN || "psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql], { windowsHide: true });
    let output = "", error = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { error += data; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
  });
}
const email = `concurrency-${randomUUID()}@test.invalid`;
const attempts = Array.from({ length: 12 }, () => randomUUID());
try {
  const results = await Promise.all(attempts.map(id => query(
    `select rubricheck_reserve_free_evaluate('${email}',3,'${id}','${id}')`))); 
  const allowed = results.map((raw, index) => ({ result: JSON.parse(raw), id: attempts[index] })).filter(({ result }) => result.status === "reserved");
  assert.equal(allowed.length, 3, "parallel requests cannot exceed the trial limit");
  assert.equal(await query(`select evaluate_count from free_usage_counters where email='${email}'`), "0");
  await Promise.all(allowed.flatMap(({ id }) => Array.from({ length: 4 }, () => query(
    `select rubricheck_settle_free_evaluate('${email}','${id}',true,3)`))));
  assert.equal(await query(`select rubricheck_get_free_evaluate_usage_count('${email}')`), "3", "parallel repeated confirmations count exactly once");
  console.log("PASS: 12 concurrent reservations and 12 repeated confirmations respect the three-use quota.");
} finally {
  await query(`delete from free_evaluate_reservations where email='${email}'; delete from free_usage_counters where email='${email}'`);
}
