import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mock, test } from "node:test";
import type Stripe from "stripe";
const rows=new Map<string,Record<string,unknown>>();
mock.module("./growthServer.ts",{namedExports:{growthEnabled:()=>true,growthHash:(s:string)=>createHash("sha256").update(s).digest("hex")}});
mock.module("./supabaseRest.ts",{namedExports:{callSupabaseRpc:async(_name:string,args:Record<string,unknown>)=>{if(!rows.has(String(args.p_key)))rows.set(String(args.p_key),args);}}});
const {recordStripeGrowth}=await import("./growthPayments.ts");
const account="a".repeat(64);
const stripe={subscriptions:{retrieve:async()=>({metadata:{growth_account:account,pro_plan:"annual"},items:{data:[]}})},refunds:{list:async function*(){yield{id:"re_1",created:100,status:"succeeded",amount:200,currency:"cad"};yield{id:"re_2",created:101,status:"succeeded",amount:100,currency:"cad"};}}} as unknown as Stripe;
const event=(type:string,object:unknown,livemode=true)=>({type,data:{object},livemode,created:123}) as Stripe.Event;
test("only authoritative paid one-time checkout is counted; replays and async completion deduplicate by payment intent",async()=>{
  rows.clear();const s={id:"cs_live_private",created:100,mode:"payment",payment_status:"unpaid",payment_intent:"pi_secret",amount_total:499,currency:"cad",metadata:{growth_account:account,purchase_type:"credits"}};
  await recordStripeGrowth(event("checkout.session.completed",s),stripe);assert.equal(rows.size,0);
  s.payment_status="paid";
  await recordStripeGrowth(event("checkout.session.completed",s,false),stripe);assert.equal(rows.size,0);
  await recordStripeGrowth(event("checkout.session.completed",s),stripe);
  await recordStripeGrowth(event("checkout.session.async_payment_succeeded",s),stripe);
  assert.equal(rows.size,1);assert.equal([...rows.values()][0].p_kind,"one_time");
  assert.equal([...rows.values()][0].p_at,new Date(123000).toISOString(),"payment date uses success event, not earlier checkout creation");
  assert.ok(!JSON.stringify([...rows]).includes("pi_secret"));
});
test("subscription checkout never duplicates invoice payments; first and renewal have different kinds",async()=>{
  rows.clear();await recordStripeGrowth(event("checkout.session.completed",{mode:"subscription",payment_status:"paid",amount_total:5999}),stripe);assert.equal(rows.size,0);
  const invoice={id:"in_1",status:"paid",amount_paid:5999,billing_reason:"subscription_create",currency:"cad",status_transitions:{paid_at:120},parent:{subscription_details:{subscription:"sub_1"}},customer:null};
  await recordStripeGrowth(event("invoice.payment_succeeded",invoice),stripe);await recordStripeGrowth(event("invoice.payment_succeeded",invoice),stripe);
  await recordStripeGrowth(event("invoice.payment_succeeded",{...invoice,id:"in_2",billing_reason:"subscription_cycle"}),stripe);
  assert.equal(rows.size,2);assert.deepEqual([...rows.values()].map(r=>r.p_kind),["subscription_initial","subscription_renewal"]);
  assert.ok([...rows.values()].every(r=>r.p_product==="pro_annual"));
});
test("partial refunds are keyed by refund ID so repeated cumulative charge events cannot double count",async()=>{
  rows.clear();const charge={id:"ch_1",customer:null,metadata:{growth_account:account,pro_plan:"lifetime"}};
  await recordStripeGrowth(event("charge.refunded",charge),stripe);await recordStripeGrowth(event("charge.refunded",charge),stripe);
  assert.equal(rows.size,2);assert.equal([...rows.values()].reduce((n,r)=>n+Number(r.p_amount),0),-300);
});
