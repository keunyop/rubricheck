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
test("linked guest-to-account identity converts across journey segments and excludes paid evaluations from free cohort",()=>{
  const r=report([e("guest_preview_completed","a",1),e("signup_completed","a",2,{journey:"new_account"}),e("evaluation_completed","a",3,{journey:"new_account",product:"pro"})]);
  assert.equal(r.funnel.find(r=>r.step==="Guest preview → signup")!.converted,1);
  assert.equal(r.funnel.find(r=>r.step==="Signup → first meaningful evaluation")!.converted,1);
  assert.equal(r.funnel.find(r=>r.step==="Free evaluation → checkout")!.eligible,0);
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
