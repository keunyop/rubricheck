import assert from "node:assert/strict";
import { mock, test } from "node:test";
const calls: Record<string,unknown>[]=[];
let fail=false;
mock.module("./supabaseRest.ts",{namedExports:{hasSupabaseConfig:()=>true,callSupabaseRpc:async(_name:string,params:Record<string,unknown>)=>{if(fail)throw Error("storage unavailable");calls.push(params);}}});
const {instrumentGrade,visitorCookie}=await import("./growthServer.ts");
const { createCreditSessionToken } = await import("./creditSession.ts");
process.env.GROWTH_ANALYTICS_ENABLED="true";process.env.GROWTH_HASH_SECRET="synthetic-test-only";
const request=()=>new Request("http://localhost/api/grade",{headers:{cookie:`rubricheck_growth=${visitorCookie("33333333-3333-4333-8333-333333333333")}`}});
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
test("validation failure records a fixed reason without copying a private response",async()=>{
  calls.length=0;
  const response=await instrumentGrade(request(),async()=>Response.json({code:"FILE_PARSE_FAILED",message:"PRIVATE ASSIGNMENT",field:"assignment"},{status:400}));
  assert.equal(response.status,400);
  assert.equal(calls[1].p_failure,"validation_file");
  assert.ok(!JSON.stringify(calls).includes("PRIVATE ASSIGNMENT"));
  assert.ok(!JSON.stringify(calls).includes("assignment"));
});
test("a guest preview is measured automatically and an explicit refusal produces no events",async()=>{
  calls.length=0;await instrumentGrade(request(),async()=>Response.json({guest_preview:true,summary:"private"}));
  assert.equal(calls[1].p_event_name,"guest_preview_completed");
  const denied = request();
  denied.headers.set("cookie", denied.headers.get("cookie") + "; rubricheck_analytics=denied");
  calls.length=0;await instrumentGrade(denied,async()=>Response.json({ok:true}));assert.equal(calls.length,0);
});

const inputCodes = ["INVALID_JSON", "INVALID_INPUT", "INVALID_MODE", "INVALID_FORM_DATA", "MISSING_INPUT", "TRIAL_INPUT_TOO_LONG"];
test("input subreasons log only fixed code and guest/account before the unchanged terminal RPC", async (t) => {
  const diagnostics: unknown[][] = [];
  const logger = t.mock.method(console, "info", (...args: unknown[]) => {
    assert.deepEqual(calls.map(call => call.p_event_name), ["evaluation_started"]);
    diagnostics.push(args);
  });
  const priorSecret = process.env.ENTITLEMENT_SESSION_SECRET;
  process.env.ENTITLEMENT_SESSION_SECRET = "synthetic-session-secret";
  try {
    for (const product of ["guest", "account"]) {
      for (const code of inputCodes) {
        calls.length = 0;
        const input = request();
        if (product === "account") input.headers.set("cookie", `${input.headers.get("cookie")}; rubricheck_credit_session=${createCreditSessionToken({ email: "synthetic@example.test" })}`);
        const payload = { code, message: "PRIVATE MESSAGE", field: "PRIVATE FIELD", assignment: "PRIVATE INPUT", guest_preview: product === "account" };
        // A response field cannot override the server-verified account distinction.
        const response = await instrumentGrade(input, async () => Response.json(payload, { status: 400 }));
        assert.deepEqual(await response.json(), payload);
        assert.deepEqual(diagnostics.at(-1), ["GROWTH_VALIDATION_INPUT", { code, product }]);
        assert.deepEqual(calls.map(call => call.p_event_name), ["evaluation_started", "evaluation_failed"]);
        assert.equal(calls[1].p_failure, "validation_input");
        assert.equal(calls[0].p_attempt, calls[1].p_attempt);
      }
    }
    assert.equal(logger.mock.callCount(), inputCodes.length * 2);
    assert.equal(JSON.stringify(diagnostics).includes("PRIVATE"), false);
    assert.equal(JSON.stringify(diagnostics).includes("synthetic@"), false);
    assert.equal(JSON.stringify(diagnostics).includes("33333333"), false);
  } finally {
    if (priorSecret === undefined) delete process.env.ENTITLEMENT_SESSION_SECRET;
    else process.env.ENTITLEMENT_SESSION_SECRET = priorSecret;
  }
});

test("input diagnostics suppress non-input, unknown, access, server and successful outcomes", async (t) => {
  const logger = t.mock.method(console, "info", () => {});
  for (const [status, code] of [[400, "PRIVATE UNKNOWN"], [400, "FILE_PARSE_FAILED"], [400, { private: "INVALID_INPUT" }], [500, "INVALID_INPUT"], [401, "INVALID_INPUT"], [403, "INVALID_INPUT"], [429, "INVALID_INPUT"], [200, "INVALID_INPUT"]] as const) {
    calls.length = 0;
    const response = await instrumentGrade(request(), async () => Response.json({ code }, { status }));
    assert.equal(response.status, status);
    assert.equal(calls.length, 2);
  }
  assert.equal(logger.mock.callCount(), 0);
});

test("input diagnostics preserve consent, identity and enabled gates", async (t) => {
  const logger = t.mock.method(console, "info", () => {});
  const inputs = [request(), request(), request(), request(), request(), request()];
  inputs[0].headers.set("cookie", `${inputs[0].headers.get("cookie")}; rubricheck_analytics=denied`);
  inputs[1].headers.set("dnt", "1");
  inputs[2].headers.set("sec-gpc", "1");
  inputs[3].headers.delete("cookie");
  inputs[4].headers.set("cookie", "rubricheck_growth=unsigned-private-visitor");
  inputs[5].headers.set("cookie", `rubricheck_growth=${visitorCookie("33333333-3333-4333-8333-333333333333", 0)}`);
  for (const input of inputs) {
    calls.length = 0;
    assert.equal((await instrumentGrade(input, async () => Response.json({ code: "MISSING_INPUT" }, { status: 400 }))).status, 400);
    assert.equal(calls.length, 0);
  }
  process.env.GROWTH_ANALYTICS_ENABLED = "false";
  try {
    calls.length = 0;
    await instrumentGrade(request(), async () => Response.json({ code: "MISSING_INPUT" }, { status: 400 }));
    assert.equal(calls.length, 0);
  } finally { process.env.GROWTH_ANALYTICS_ENABLED = "true"; }
  assert.equal(logger.mock.callCount(), 0);
});

test("input diagnostics survive analytics storage outages and logger failure never changes grading", async (t) => {
  const diagnostics: unknown[][] = [];
  const logger = t.mock.method(console, "info", (...args: unknown[]) => { diagnostics.push(args); });
  t.mock.method(console, "warn", () => {});
  const payload = { code: "INVALID_FORM_DATA", message: "PRIVATE RESPONSE" };
  fail = true;
  try {
    const response = await instrumentGrade(request(), async () => Response.json(payload, { status: 400 }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), payload);
    assert.deepEqual(diagnostics, [["GROWTH_VALIDATION_INPUT", { code: "INVALID_FORM_DATA", product: "guest" }]]);
  } finally { fail = false; }
  logger.mock.mockImplementation(() => { throw Error("logger unavailable"); });
  calls.length = 0;
  const response = await instrumentGrade(request(), async () => Response.json(payload, { status: 400 }));
  assert.deepEqual(await response.json(), payload);
  assert.equal(response.status, 400);
  assert.deepEqual(calls.map(call => call.p_event_name), ["evaluation_started", "evaluation_failed"]);
  assert.equal(calls[1].p_failure, "validation_input");
});
