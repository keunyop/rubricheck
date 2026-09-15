// Optional integration smoke test: real configured AI, disposable LOCAL database only.
// This makes billable model calls; it never writes to the configured Supabase service.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
if (process.env.LAB_LIVE_AI !== "1") throw new Error("Set LAB_LIVE_AI=1 to run the real-model integration smoke test.");
try { process.loadEnvFile(".env.local"); } catch {}
const connection = process.env.LAB_TEST_DATABASE_URL ?? "postgresql://lab_test@127.0.0.1:55439/postgres";
if (!["127.0.0.1","localhost","[::1]"].includes(new URL(connection).hostname)) throw new Error("Local database required.");
const quote = value => "'" + String(value).replaceAll("'","''") + "'";
const sql = query => new Promise((resolve,reject)=>{
  const child=spawn(process.env.PSQL_PATH??"psql",[connection,"-X","-A","-t","-v","ON_ERROR_STOP=1","-f","-"],{windowsHide:true,env:{...process.env,PGCLIENTENCODING:"UTF8"}});
  child.stdin.end(query + ";\n");
  let output="",errors="";
  child.stdout.on("data",data=>{output+=data;});child.stderr.on("data",data=>{errors+=data;});
  child.on("error",reject);child.on("close",code=>code===0?resolve(output.trim()):reject(new Error(errors)));
});
const originalFetch=globalThis.fetch;
globalThis.fetch=async (input,init)=>{
  const url=String(input),path=new URL(url).pathname;
  if(path.startsWith("/rest/v1/rpc/")){
    const name=path.split("/").at(-1);
    if(!/^lab_[a-z_]+$/.test(name)) throw new Error("Only lab database RPCs are allowed in this smoke test.");
    const body=JSON.parse(String(init.body));
    const args=Object.entries(body).map(([key,value])=>{
      assert.match(key,/^p_[a-z_]+$/);
      const literal=value===null?"null":typeof value==="boolean"?String(value):typeof value==="object"?quote(JSON.stringify(value))+"::jsonb":quote(value);
      return key+" => "+literal;
    }).join(",");
    try { return new Response(await sql("select coalesce(to_jsonb(public."+name+"("+args+"))::text,'null')"),{headers:{"Content-Type":"application/json"}}); }
    catch(error){console.error("LOCAL_SMOKE_SQL_FAILED",name,String(error));return new Response(String(error),{status:400});}
  }
  return originalFetch(input,init);
};
const {resolveLabUser,labRpc}=await import("../src/lib/assignmentLab/store.ts");
const {evaluateLabAssignment}=await import("../src/lib/assignmentLab/evaluate.ts");
let owner;
try{
  owner=await resolveLabUser("lab-smoke-"+randomUUID()+"@example.invalid");
  const id=randomUUID();
  const rubric="Evaluate a short argument about a fictional classroom pilot. Evidence (10 points): cite and explain the supplied classroom dataset: 18 of 30 learners completed optional practice before the pilot; 24 of 30 completed it during the pilot. Do not claim causation from this before/after comparison. Reasoning (10 points): state a clear recommendation, examine the alternative explanation that teacher reminders changed, and acknowledge the small sample. These two criteria have equal weight.";
  const draft="The classroom should continue the optional practice pilot. Participation seemed better, so the pilot caused the improvement. Everyone will benefit.";
  await labRpc("create_assignment",{p_owner:owner,p_id:id,p_title:"Synthetic local integration test",p_rubric:rubric,p_draft:draft,p_mode:"standard",p_pro:false});
  const first=await evaluateLabAssignment(owner,id,draft,false);
  assert.equal(first.workspace.runs.length,1);
  const revision="The classroom should continue the optional practice pilot on a trial basis. The supplied classroom dataset shows that 18 of 30 learners completed optional practice before the pilot, compared with 24 of 30 during it. This increase of six learners supports cautiously continuing the pilot, because participation is the outcome the pilot aims to improve. However, teacher reminders also changed, so reminders may explain the increase. This before/after comparison does not establish that the pilot caused the increase. With only 30 learners in one classroom, the result may not generalize. The next trial should keep reminder frequency constant and compare similar groups before expanding the programme.";
  const second=await evaluateLabAssignment(owner,id,revision,false);
  assert.equal(second.workspace.runs.length,2);
  assert.equal(second.workspace.runs[0].draft_text,draft);
  assert.deepEqual(second.workspace.runs[0].conditions,second.workspace.runs[1].conditions);
  const reused=await evaluateLabAssignment(owner,id,revision,false);
  assert.equal(reused.reused,true);
  console.log(JSON.stringify({passed:true,versions:second.workspace.runs.length,reused:reused.reused,ranges:second.workspace.runs.map(run=>run.result.overall_range),tasks:second.workspace.runs.map(run=>run.tasks.map(task=>task.status))}));
}finally{
  globalThis.fetch=originalFetch;
  if(owner) await sql("delete from lab_users where id="+quote(owner));
}


