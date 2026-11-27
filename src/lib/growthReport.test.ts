import assert from "node:assert/strict";
import test from "node:test";
import { summarizeGrowth, type GrowthEventRow, type GrowthPaymentRow } from "./growthReport.ts";

const from="2026-10-01T07:00:00Z",to="2026-10-22T07:00:00Z";
function e(name:string,actor:string,day:number,extra:Partial<GrowthEventRow>={}):GrowthEventRow {return {event_key:crypto.randomUUID(),event_name:name,actor,occurred_at:`2026-10-${String(day).padStart(2,"0")}T08:00:00Z`,account_key:actor,visitor_id:null,journey:"guest",product:"free",attempt_id:null,evaluation_id:null,failure:null,prior_payer:false,first_touch:null,last_touch:null,country:"unknown",...extra};}
function p(extra:Partial<GrowthPaymentRow>={}):GrowthPaymentRow {return {payment_key:"payment",account_key:"a",occurred_at:"2026-10-03T08:00:00Z",product:"pro_annual",kind:"subscription_initial",amount_minor:5999,currency:"cad",prior_payer:false,first_paid_at:"2026-10-03T08:00:00Z",first_touch:null,last_touch:null,country:"unknown",...extra};}
const report=(events:GrowthEventRow[],payments:GrowthPaymentRow[]=[])=>summarizeGrowth({events,payments,collectionStartedAt:from,generatedAt:to},from,to);
test("funnel uses unique entrants, ordered events and mature seven-day observation windows",()=>{
  const r=report([e("page_view","a",1),e("page_view","a",2),e("evaluation_started","a",3),e("page_view","b",2),e("evaluation_started","b",1),e("page_view","c",20)]);
  const row=r.funnel.find(r=>r.step==="Visitor → evaluation started")!;
  assert.equal(row.eligible,2);assert.equal(row.converted,1);assert.equal(row.pending,1);assert.equal(row.rate,.5);
});
test("result views match the evaluation attempt, with failures separate from no observed conversion",()=>{
  const r=report([e("evaluation_started","a",2,{attempt_id:"one"}),e("evaluation_result_viewed","a",3,{attempt_id:"two"}),e("evaluation_failed","a",2,{attempt_id:"one",failure:"server"})]);
  const row=r.funnel.find(r=>r.step==="Evaluation started → result viewed")!;
  assert.equal(row.converted,0);assert.equal(row.failed,1);assert.equal(r.failures.server,1);
});
test("new validation reasons roll up with historical validation events",()=>{
  const r=report([e("evaluation_failed","a",2,{failure:"validation"}),e("evaluation_failed","b",2,{failure:"validation_file"}),e("evaluation_failed","c",2,{failure:"validation_rubric"})]);
  assert.equal(r.failures.validation,3);
  assert.equal(r.validationReasons.validation_file,1);
  assert.equal(r.validationReasons.validation_rubric,1);
});
test("linked guest-to-account identity converts across journey segments",()=>{
  const r=report([e("guest_preview_completed","a",1),e("signup_completed","a",2,{journey:"new_account"}),e("evaluation_completed","a",3,{journey:"new_account",product:"pro"})]);
  assert.equal(r.funnel.find(r=>r.step==="Guest preview → signup")!.converted,1);
  assert.equal(r.funnel.find(r=>r.step==="Signup → first meaningful evaluation")!.converted,1);
});
test("result-to-checkout requires a linked view before checkout and counts each actor once",()=>{
  const r = report([
    e("guest_preview_completed","a",2,{attempt_id:"preview"}),
    e("evaluation_result_viewed","a",4,{attempt_id:"preview"}),
    e("evaluation_result_viewed","a",5,{attempt_id:"preview"}),
    e("checkout_started","a",6),
    e("evaluation_completed","b",2,{evaluation_id:"full"}),
    e("checkout_started","b",3),
    e("evaluation_result_viewed","b",4,{evaluation_id:"full"}),
    e("evaluation_result_viewed","c",4,{evaluation_id:"full"}),
    e("checkout_started","c",6),
    e("evaluation_completed","d",2,{attempt_id:"unseen"}),
    e("checkout_started","d",6),
    e("evaluation_result_viewed","e",3,{attempt_id:"later"}),
    e("evaluation_completed","e",4,{attempt_id:"later"}),
  ]);
  const row = r.funnel.find(row => row.step === "First valid result viewed → checkout")!;
  assert.equal(row.eligible,2);
  assert.equal(row.converted,1);
});
test("first purchase excludes renewals and unknown historical payers; currencies and Lifetime remain separate",()=>{
  const r=report([e("checkout_started","a",2),e("checkout_started","b",2),e("checkout_started","c",2)], [p(),p({payment_key:"renewal",account_key:"b",kind:"subscription_renewal",prior_payer:true}),p({payment_key:"unknown",account_key:"c",prior_payer:null}),p({payment_key:"lifetime",account_key:"d",product:"pro_lifetime",kind:"one_time",amount_minor:9999,currency:"usd"}),p({payment_key:"refund",kind:"refund",amount_minor:-100})]);
  assert.equal(r.funnel.find(r=>r.step==="Checkout → first successful purchase")!.converted,1);
  assert.equal(r.firstPurchaseUnknown,1);assert.equal(r.acquisition.length,2);
  assert.equal(r.acquisition.find(a=>a.currency==="usd")!.lifetimeMinor,9999);
  assert.equal(r.acquisition.find(a=>a.currency==="cad")!.refundsMinor,100);
});
test("missing baselines and truncated reports never present a made-up conversion rate",()=>{
  assert.ok(report([]).funnel.every(r=>r.rate===null));
  const r=report(Array.from({length:50001},()=>e("page_view","a",1)));
  assert.equal(r.complete,false);assert.ok(r.funnel.every(r=>r.rate===null));
});

test("one mature result cohort measures ordered checkout and first payment with a shared denominator", () => {
  const views = (actor: string, day = 2, extra: Partial<GrowthEventRow> = {}) => [
    e("evaluation_completed", actor, day, { attempt_id: actor, ...extra }),
    e("evaluation_result_viewed", actor, day, { attempt_id: actor, ...extra }),
  ];
  const credit = (actor: string) => p({ account_key: actor, product: "credits", kind: "one_time" });
  const r = report([
    ...views("a"), e("checkout_started","a",2,{product:"credits",occurred_at:"2026-10-02T09:00:00Z"}),
    ...views("b"), e("checkout_started","b",2,{product:"pro_annual",occurred_at:"2026-10-02T09:00:00Z"}),
    ...views("c"), e("checkout_started","c",1,{product:"credits"}),
    ...views("d"), e("checkout_started","d",2,{product:"credits",occurred_at:"2026-10-02T09:00:00Z"}),
    ...views("e",2,{prior_payer:null}), ...views("f",20), ...views("g",2,{prior_payer:true}),
    ...views("h"), e("checkout_started","h",2,{product:"pro_annual",occurred_at:"2026-10-02T09:00:00Z"}),
  ], [credit("a"), p({account_key:"b"}), credit("c"), p({account_key:"d"}),
    p({account_key:"h",kind:"subscription_renewal"})]);
  assert.deepEqual(r.revenueCohort, {
    eligible:5, checkoutStarted:4, firstPaymentMatched:2, firstPaymentUnmatched:3,
    paid:{subscription:1,credit:1,lifetime:0}, pending:1, unknownHistory:1, priorPaid:1,
    checkoutRate:4/5, firstPaymentRate:2/5,
  });
});
