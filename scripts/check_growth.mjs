// Local end-to-end analytics check. Requires a disposable local PostgreSQL database
// with credits_mvp.sql and the growth migration, plus the existing Playwright install.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:"playwright");
const psql=process.env.PSQL_BIN??"psql";
const db="rubricheck_growth_test"; // Deliberately fixed, never production.
function query(sql){
  const r=spawnSync(psql,["-h","127.0.0.1","-p",process.env.GROWTH_TEST_PGPORT??"55483","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-tAX","-c",sql],{encoding:"utf8",windowsHide:true});
  if(r.status!==0)throw Error(r.stderr||"Local test SQL failed");return r.stdout.trim();
}
const quote=value=>value===null?"null":typeof value==="boolean"?String(value):typeof value==="number"?String(value):"'"+(typeof value==="object"?JSON.stringify(value):String(value)).replaceAll("'","''")+"'";
const allowed=new Set(["rubricheck_growth_event","rubricheck_growth_report","rubricheck_growth_opt_out","rubricheck_growth_identify"]);
const seen=[];
const adapter=createServer(async(req,res)=>{
  try{
    let body="";for await(const chunk of req)body+=chunk;
    const value=JSON.parse(body||"null");res.setHeader("Content-Type","application/json");
    if(req.url==="/pipeline" || req.url==="/" || req.url==="/multi-exec"){
      const commands=Array.isArray(value?.[0])?value:[value];const values=commands.map(()=>({result:1}));res.end(JSON.stringify(Array.isArray(value?.[0])?values:values[0]));return;
    }
    const name=req.url?.split("/").pop();if(!allowed.has(name))throw Error("Unexpected local RPC");
    seen.push({name,value});
    const result=query(`select public.${name}(${Object.entries(value).map(([k,v])=>`${k} => ${quote(v)}`).join(",")});`);
    res.end(result||"null");
  }catch(error){res.statusCode=500;res.end(JSON.stringify({error:String(error.message)}));}
});
adapter.listen(0,"127.0.0.1");await once(adapter,"listening");
const storage=`http://127.0.0.1:${adapter.address().port}`;
const port=Number(process.env.GROWTH_TEST_PORT??3119),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)],{windowsHide:true,stdio:["ignore","pipe","pipe"],env:{...process.env,
  SUPABASE_URL:storage,SUPABASE_SERVICE_ROLE_KEY:"local-only",UPSTASH_REDIS_REST_URL:storage,UPSTASH_REDIS_REST_TOKEN:"local-only",
  OPENAI_API_KEY:"local-test-no-network",GOOGLE_CLOUD_VISION_API_KEY:"local-test-no-network",STRIPE_SECRET_KEY:"sk_test_local_only",STRIPE_WEBHOOK_SECRET:"local-only",ENTITLEMENT_SESSION_SECRET:"local-only",ENTITLEMENT_OTP_SECRET:"local-only",
  GROWTH_ANALYTICS_ENABLED:"true",GROWTH_HASH_SECRET:"local-growth-only",ADMIN_SECRET:"local-admin-only",NEXT_PUBLIC_APP_URL:base,
}});
let serverOutput="";server.stdout.on("data",c=>serverOutput+=c);server.stderr.on("data",c=>serverOutput+=c);
let browser;
try{
  for(let i=0;i<60;i++){try{if((await fetch(base+"/pricing")).ok)break;}catch{}if(i===59)throw Error("Local server failed: "+serverOutput.slice(-1500));await delay(500);}
  browser=await chromium.launch({headless:true});
  async function context(consent,gpc=false){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    if(consent)await context.addCookies([{name:"rubricheck_analytics",value:"granted",url:base}]);
    if(gpc)await context.addInitScript(()=>Object.defineProperty(navigator,"globalPrivacyControl",{value:true}));
    await context.route("**/*",async route=>{
      const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
      if(url.pathname.startsWith("/api/")&&!url.pathname.startsWith("/api/analytics")&&!url.pathname.startsWith("/api/admin/growth"))return route.fulfill({json:{signedIn:false,plan:"free",remainingEvaluations:3,creditsBalance:0,used:false,images:[],projects:[],assignments:[],preferences:null}});
      return route.continue();
    });return context;
  }
  const off=await context(false),offPage=await off.newPage();await offPage.goto(base+"/pricing");await offPage.getByText("Occasional assignment checks",{exact:false}).waitFor();await delay(500);
  assert.equal(seen.filter(x=>x.name==="rubricheck_growth_event").length,0,"no collection without consent");await off.close();
  const gpc=await context(true,true),gpcPage=await gpc.newPage();await gpcPage.goto(base+"/pricing");await delay(500);assert.equal(seen.filter(x=>x.name==="rubricheck_growth_event").length,0,"GPC blocks consented tracking");await gpc.close();
  const on=await context(true),page=await on.newPage();const statuses=[];page.on("response",r=>{if(r.url().includes("/api/analytics"))statuses.push(r.status());});await page.goto(base+"/pricing?utm_source=google&utm_medium=organic&utm_campaign=malaysia-students&email=private-sentinel@example.invalid&checkout_session_id=private-sentinel");
  for(let i=0;i<30&&!seen.some(x=>x.value?.p_event_name==="pricing_viewed");i++)await delay(300);
  if(!seen.some(x=>x.value?.p_event_name==="page_view"))console.log("DEBUG",JSON.stringify({statuses,enabled:await page.getAttribute("html","data-growth-enabled"),cookie:(await on.cookies()).map(c=>c.name),server:serverOutput.slice(-1200)}));
  assert.ok(seen.some(x=>x.value?.p_event_name==="page_view"),"browser -> API -> database page view");
  assert.ok(seen.some(x=>x.value?.p_event_name==="pricing_viewed"),"pricing event recorded");
  assert.ok(!JSON.stringify(seen).includes("private-sentinel"),"no sensitive URL fields cross analytics boundary");
  const visitor=seen.find(x=>x.value?.p_event_name==="page_view").value.p_visitor;
  const stored=JSON.parse(query(`select row_to_json(v) from public.growth_visitors v where visitor_id=${quote(visitor)};`));
  assert.equal(stored.first_touch.source,"google");assert.equal(stored.first_touch.campaign,"malaysia-students");assert.equal(stored.first_touch.landing,"/pricing");
  await page.getByRole("button",{name:"Compare credit packs",exact:true}).click();await page.getByText("CAD",{exact:true}).first().waitFor();
  assert.equal(await page.getByRole("heading",{name:"Evaluation Top-Ups",exact:true}).count(),1,"comparison opens credit options");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"mobile comparison fits viewport");
  assert.equal((await fetch(base+"/api/admin/growth")).status,401);
  const admin=await fetch(base+"/api/admin/growth",{headers:{"x-admin-secret":"local-admin-only"}});const report=await admin.json();assert.equal(report.available,true);assert.ok(report.funnel.some(r=>r.pending>0));assert.ok(report.funnel.every(r=>r.rate===null));
  const forged=await on.request.post(base+"/api/analytics",{headers:{origin:base},data:{name:"purchase_completed",id:crypto.randomUUID()}});assert.equal(forged.status(),400,"browser cannot invent purchases");
  await Promise.all([page.waitForEvent("load"),page.getByRole("button",{name:"Turn off analytics"}).click()]);assert.ok(!(await on.cookies()).some(c=>c.name==="rubricheck_growth"),"withdrawal clears visitor cookie");
  await on.close();console.log("PASS growth: consent, GPC, real browser/API/local SQL path, safe attribution, mobile credit positioning, admin authorization, mature cohorts, forged purchases and opt-out.");
}finally{if(browser)await browser.close();server.kill();adapter.close();}
