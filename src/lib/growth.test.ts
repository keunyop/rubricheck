import assert from "node:assert/strict";
import test from "node:test";
import { acquisitionTouch, publicGrowthPath, sanitizeTouch, validGrowthId, growthFailureCategory, sameGrowthOrigin } from "./growth.ts";
import { growthConsent, growthVisitor, visitorCookie, growthHash, growthCountry } from "./growthServer.ts";

test("attribution drops PII, secrets, private paths and arbitrary campaign values",()=>{
  const touch=acquisitionTouch("https://rubricheck.com/?utm_source=student@example.com&utm_campaign=secret_person&utm_medium=email&assignment=secret&checkout_session_id=cs_live_secret#private","https://student.example.com/private?email=student@example.com");
  assert.deepEqual(touch,{source:"unknown",medium:"email",campaign:"unknown",landing:"/",referrer:"other"});
  assert.equal(JSON.stringify(touch).includes("student"),false);
  assert.equal(publicGrowthPath("/api/workspace/private"),"unknown");
  assert.equal(publicGrowthPath("/ko/workspace?evaluation_id=private&checkout_session_id=secret"),"/workspace");
  assert.equal(publicGrowthPath("/ms/pricing?email=secret"),"/pricing");
  assert.equal(sanitizeTouch({source:"google",landing:"/private",email:"secret"}).landing,"unknown");
});
test("acquisition distinguishes organic, approved UTM, direct and unknown referrals",()=>{
  assert.equal(acquisitionTouch("https://rubricheck.com/","https://www.google.com.my/search?q=secret").source,"google");
  assert.equal(acquisitionTouch("https://rubricheck.com/?utm_source=reddit&utm_medium=social&utm_campaign=malaysia-students","").campaign,"malaysia-students");
  assert.equal(acquisitionTouch("https://rubricheck.com/","https://rubricheck.com/pricing").source,"direct");
});
test("consent honors DNT and GPC even with an opt-in cookie",()=>{
  assert.equal(growthConsent(new Request("http://localhost")),false);
  for(const signal of ["dnt","sec-gpc"]) assert.equal(growthConsent(new Request("http://localhost",{headers:{cookie:"rubricheck_analytics=granted",[signal]:"1"}})),false);
  assert.equal(growthConsent(new Request("http://localhost",{headers:{cookie:"rubricheck_analytics=granted"}})),true);
});
test("same-origin validation handles Next internal rewrites but rejects cross-site and absent origins",()=>{
  assert.equal(sameGrowthOrigin(new Request("http://localhost:3119/api/analytics",{headers:{host:"127.0.0.1:3119",origin:"http://127.0.0.1:3119"}})),true);
  assert.equal(sameGrowthOrigin(new Request("http://localhost/api/analytics",{headers:{host:"rubricheck.com",origin:"https://rubricheck.com"}})),true);
  assert.equal(sameGrowthOrigin(new Request("https://rubricheck.com/api/analytics",{headers:{origin:"https://evil.example"}})),false);
  assert.equal(sameGrowthOrigin(new Request("https://rubricheck.com/api/analytics")),false);
});
test("visitor identity is signed, expires and cannot be forged or set without consent",()=>{
  const keys=["GROWTH_HASH_SECRET","GROWTH_ANALYTICS_ENABLED","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
  const old=keys.map(k=>process.env[k]);
  try {
    process.env.GROWTH_HASH_SECRET="test-secret";process.env.GROWTH_ANALYTICS_ENABLED="true";process.env.SUPABASE_URL="http://localhost";process.env.SUPABASE_SERVICE_ROLE_KEY="test";
    const id="55555555-5555-4555-8555-555555555555";
    const request=(value:string,consent=true)=>new Request("http://localhost",{headers:{cookie:`rubricheck_growth=${value}; ${consent?"rubricheck_analytics=granted":""}`}});
    const token=visitorCookie(id);
    assert.equal(growthVisitor(request(token)),id);
    assert.equal(growthVisitor(request(token.replace("55555555","66666666"))),null);
    assert.equal(growthVisitor(request(visitorCookie(id,0))),null);
    assert.equal(growthVisitor(request(token,false)),null);
    assert.equal(growthHash("account:student@example.com").includes("student"),false);
    assert.equal(validGrowthId("private assignment"),false);
  } finally {keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
});
test("failures are classified without storing server messages",()=>{
  assert.equal(growthFailureCategory(504),"server");assert.equal(growthFailureCategory(429),"access");assert.equal(growthFailureCategory(400),"validation");
  const prior=process.env.VERCEL;delete process.env.VERCEL; assert.equal(growthCountry(new Request("http://localhost",{headers:{"x-vercel-ip-country":"MY"}})),"unknown"); if(prior!==undefined)process.env.VERCEL=prior;
});
