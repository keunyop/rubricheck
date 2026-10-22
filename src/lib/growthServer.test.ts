import assert from "node:assert/strict";
import { mock, test } from "node:test";
const calls: Record<string,unknown>[]=[];
let fail=false;
mock.module("./supabaseRest.ts",{namedExports:{hasSupabaseConfig:()=>true,callSupabaseRpc:async(_name:string,params:Record<string,unknown>)=>{if(fail)throw Error("storage unavailable");calls.push(params);}}});
const {instrumentGrade,visitorCookie}=await import("./growthServer.ts");
process.env.GROWTH_ANALYTICS_ENABLED="true";process.env.GROWTH_HASH_SECRET="synthetic-test-only";
const request=()=>new Request("http://localhost/api/grade",{headers:{cookie:`rubricheck_analytics=granted; rubricheck_growth=${visitorCookie("33333333-3333-4333-8333-333333333333")}`}});
test("grading measurement preserves response and sends only allowed metadata, with billing source rather than access tier",async()=>{
  calls.length=0;
  const result={evaluation_id:"44444444-4444-4444-8444-444444444444",access_tier:"topup",summary:"PRIVATE ASSIGNMENT",title:"PERSON NAME",criteria:[{feedback:"PRIVATE RUBRIC"}]};
  const response=await instrumentGrade(request(),async()=>Response.json(result,{headers:{"x-growth-product":"free"}}));
  assert.deepEqual(await response.json(),result);assert.ok(response.headers.get("x-growth-attempt"));
  assert.deepEqual(calls.map(r=>r.p_event_name),["evaluation_started","evaluation_completed"]);
  assert.equal(calls[1].p_product,"free");assert.equal(calls[0].p_attempt,calls[1].p_attempt);
  assert.ok(!JSON.stringify(calls).includes("PRIVATE"));assert.ok(!JSON.stringify(calls).includes("PERSON"));
});
test("server failures are distinct from abandonment and analytics outages do not change grading",async()=>{
  calls.length=0;
  const response=await instrumentGrade(request(),async()=>Response.json({message:"private failure"},{status:504}));
  assert.equal(response.status,504);assert.equal(calls[1].p_event_name,"evaluation_failed");assert.equal(calls[1].p_failure,"server");assert.ok(!JSON.stringify(calls).includes("private failure"));
  fail=true;
  try {assert.equal((await instrumentGrade(request(),async()=>Response.json({ok:true}))).status,200);}finally{fail=false;}
});
test("a guest preview is measured separately and no consent produces no events",async()=>{
  calls.length=0;await instrumentGrade(request(),async()=>Response.json({guest_preview:true,summary:"private"}));
  assert.equal(calls[1].p_event_name,"guest_preview_completed");
  calls.length=0;await instrumentGrade(new Request("http://localhost"),async()=>Response.json({ok:true}));assert.equal(calls.length,0);
});
