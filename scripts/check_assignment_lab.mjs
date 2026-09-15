import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";

try { process.loadEnvFile(".env.local"); } catch {}
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3107";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Use a local test server.");
const secret = process.env.ENTITLEMENT_SESSION_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;
if (!secret) throw new Error("Set the local server's session secret.");
const email = process.env.LAB_TEST_EMAIL ?? "kylee1112@hotmail.com";
const payload = Buffer.from(JSON.stringify({ email, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url");
const token = payload + "." + createHmac("sha256",secret).update(payload).digest("base64url");
const id = randomUUID(), rubricId = randomUUID(), issueId = randomUUID(), remainingId = randomUUID();
const conditions = { rubricVersionId: rubricId, mode: "standard", model: "test-evaluator", evaluationPromptVersion: "prompt-v1", coachingPromptVersion: "coaching-v1", structureModel: "test-structure", structurePromptVersion: "structure-v1", scoringVersion: "rubric-sum-v2" };
const task = { task_key: issueId, criterion_index: 0, title: "Connect the source to the claim", reason: "The source is listed without explaining the connection.", required_evidence: "A sentence explaining how the source supports the claim.", question: "How does this source support your main claim?", status: "new", review_reason: "", evidence: [], user_done: false };
const remaining = { ...task, task_key: remainingId, criterion_index: 1, title: "Consider a counterargument", reason: "The competing explanation is missing." };
let saved = null, plan = "free", evaluationRequests = 0, failNextEvaluation = false, feedbackCount = 0;
function run(draft) {
  const version = saved.runs.length + 1;
  const revised = version > 1;
  return {
    id: randomUUID(), version, draft_text: draft, input_hash: draft, conditions, created_at: "2026-09-15T18:00:00Z",
    result: { title: "Evaluation", access_tier: "topup", summary: revised ? "The source connection is clearer, while the counterargument remains incomplete." : "The claim needs a clearer connection to supporting sources.",
      overall_range: revised ? [65,75] : [55,65], top_improvements: ["Connect the source","Consider a counterargument","Review the conclusion"],
      criteria: [{ name:"Evidence", max_score:60, score: revised ? 45 : 35, estimated_range: revised ? [40,50] : [30,40], rationale:"Evaluate source connections.", feedback: revised ? "The source connection is explained." : "Explain how the source supports your main claim." },
      { name:"Analysis",max_score:40,score:25,estimated_range:[20,30],rationale:"A competing explanation is missing.",feedback:"Consider a counterargument." }] },
    tasks: revised ? [{ ...task, user_done:false, status:"resolved", review_reason:"The source now supports the claim explicitly.",evidence:["This source supports the claim."] }, { ...remaining, user_done:false, status:"remaining" }, { ...task,user_done:false,task_key:randomUUID(),criterion_index:1,title:"Clarify the revised conclusion",status:"new" }] : [task,remaining],
  };
}
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{width:1280,height:1000}, acceptDownloads:true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
await context.addCookies([{ name:"rubricheck_credit_session",value:token,url:base,httpOnly:true,sameSite:"Lax" }]);
await context.route("**/api/**",async route=>{
  const request=route.request(), url=new URL(request.url());
  const path=url.pathname, body=request.method()==="GET"?{}:path.endsWith("/parse")?{}:request.postDataJSON();
  let json={},status=200,headers={};
  if(path==="/api/account/summary") json={signedIn:true,email,plan:"free",remainingEvaluations:3,creditsBalance:0};
  else if(path==="/api/lab/assignments") {
    if(request.method()==="DELETE"){saved=null;json={ok:true};}
    else if(request.method()==="POST") { saved={assignment:{id,title:body.title,initial_draft:body.draftText,mode:body.mode,created_at:"2026-09-15",run_count:0},rubric:{id:rubricId,raw_text:body.rubricText,structured:null,structure_model:null},runs:[]};json=saved;status=201;}
    else if(url.searchParams.has("id")) {json=saved; if(url.searchParams.has("download")) headers={"Content-Disposition":'attachment; filename="test-assignment.json"'};}
    else json={assignments:saved?[{...saved.assignment,run_count:saved.runs.length}]:[],plan};
  } else if(path.endsWith("/evaluate")){
    evaluationRequests++;
    await new Promise(resolve=>setTimeout(resolve,200));
    if(failNextEvaluation){failNextEvaluation=false;status=503;json={message:"Test evaluation failure. Your saved versions are safe."};}
    else {
      const cached=saved.runs.find(r=>r.draft_text===body.draftText);
      if(cached) json={workspace:saved,reused:true,runId:cached.id};
      else if(plan==="free"&&saved.runs.length>=2){status=403;json={message:"Your free revision trial includes V1 and V2."};}
      else {const next=run(body.draftText);saved.runs.push(next);json={workspace:saved,reused:false,runId:next.id};}
    }
  } else if(path.endsWith("/task")){
    saved.runs.find(r=>r.id===body.runId).tasks.find(t=>t.task_key===body.taskKey).user_done=body.done;json={ok:true};
  } else if(path.endsWith("/feedback")){feedbackCount++;json={ok:true};}
  else if(path.endsWith("/parse")) json={text:"Revised introduction. This source supports the claim. The argument still needs a counterargument."};
  else throw new Error("Unexpected API path "+path);
  await route.fulfill({status,json,headers});
});
try {
  await page.goto(base+"/lab/assignments");
  await page.getByRole("heading",{name:"Assignment revision workspace"}).waitFor();
  assert.match(await page.locator('meta[name="robots"]').getAttribute("content"),/noindex/);
  await page.getByPlaceholder("e.g. History essay — sources and argument").fill("History essay — evidence and reasoning");
  await page.getByPlaceholder("Paste rubric here").fill("Evidence: 60 points. Use sources that support the main claim.\nAnalysis: 40 points. Examine a counterargument.");
  await page.getByPlaceholder("Paste first draft here").fill("My first draft lists a source but does not explain its relevance.");
  await page.getByRole("button",{name:"Create workspace & evaluate V1"}).click();
  await page.getByRole("heading",{name:"V1 evaluation",exact:true}).waitFor();
  assert.equal(evaluationRequests,1);
  await page.getByText("Connect the source to the claim",{exact:true}).click();
  await page.getByText("How does this source support your main claim?",{exact:true}).first().waitFor();
  await page.getByRole("checkbox").first().click();
  await page.waitForFunction(()=>document.querySelector('input[type=checkbox]').checked && !document.querySelector('input[type=checkbox]').disabled);
  await page.reload();
  await page.getByRole("heading",{name:"V1 evaluation",exact:true}).waitFor();
  assert.equal(await page.getByRole("checkbox").first().isChecked(),true);
  console.log("PASS create, evaluate, task details, persist checkbox and reload workspace");

  const revised="My revised draft must survive an evaluation failure.";
  await page.getByPlaceholder("Paste revision draft here").fill(revised);
  failNextEvaluation=true;
  await page.getByRole("button",{name:"Evaluate V2 & compare",exact:true}).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByPlaceholder("Paste revision draft here").inputValue(),revised);
  assert.equal(saved.runs.length,1);
  await page.waitForFunction(() => !document.querySelector('input[aria-label="Upload revision draft"]').disabled);
  await page.getByLabel("Upload revision draft",{exact:true}).setInputFiles({name:"revision.txt",mimeType:"text/plain",buffer:Buffer.from("Revised text")});
  await page.getByRole("status").filter({hasText:"File text is ready"}).waitFor();
  await page.getByRole("button",{name:"Evaluate V2 & compare",exact:true}).click();
  await page.getByRole("heading",{name:"What changed in this draft?",exact:true}).waitFor();
  assert.equal(saved.runs.length,2);
  await page.getByText("+10 pts",{exact:true}).waitFor();
  await page.getByText("Still needs work",{exact:true}).waitFor();
  assert.equal(await page.getByRole("checkbox").first().isChecked(),false);
  await page.getByRole("button",{name:"Yes, helpful",exact:true}).click();
  await page.getByRole("status").filter({hasText:"feedback is saved"}).waitFor();
  assert.equal(feedbackCount,1);
  console.log("PASS failed evaluation retains input, TXT upload, V1/V2 comparison, issue statuses and feedback");

  await mkdir("doc/assignment-lab",{recursive:true});
  await page.screenshot({path:"doc/assignment-lab/desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,"mobile page must not overflow");
  await page.screenshot({path:"doc/assignment-lab/mobile.png",fullPage:true});
  await page.setViewportSize({width:1280,height:1000});
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download data",exact:true}).click();
  assert.match((await download).suggestedFilename(),/\.json$/);
  await page.getByRole("status").filter({hasText:"downloaded"}).waitFor();
  await page.getByRole("button",{name:"Check for a saved matching result",exact:true}).click();
  await page.getByRole("status").filter({hasText:"Identical text and conditions"}).waitFor();
  assert.equal(saved.runs.length,2);
  console.log("PASS desktop/mobile layout, free data download and reuse beyond trial limit");

  // A changed model must suppress numeric deltas rather than imply progress.
  saved.runs[1].conditions={...conditions,model:"changed-model"};
  await page.reload();
  await page.getByText(/Evaluation conditions changed/).waitFor();
  assert.equal(await page.getByText("Not comparable",{exact:true}).count(),2);
  saved.runs[1].conditions=conditions;
  await page.getByRole("button",{name:"Delete",exact:true}).click();
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  assert.ok(saved);
  await page.getByRole("button",{name:"Delete",exact:true}).click();
  await page.getByRole("button",{name:"Delete assignment permanently",exact:true}).click();
  await page.getByRole("heading",{name:"Start with your rubric and first draft",exact:true}).waitFor();
  assert.equal(saved,null);
  console.log("PASS changed-condition warnings and explicit deletion confirmation");
  assert.deepEqual(errors,[]);

  const anonymous=await browser.newContext();
  const anonPage=await anonymous.newPage();
  await anonPage.goto(base+"/lab/assignments");
  await anonPage.getByRole("heading",{name:"Log in to open your revision workspace",exact:true}).waitFor();
  const denied=await anonymous.request.get(base+"/api/lab/assignments");
  assert.equal(denied.status(),401);
  const sitemap=await anonymous.request.get(base+"/sitemap.xml");
  assert.doesNotMatch(await sitemap.text(),/\/lab\//);
  const home=await anonymous.request.get(base);
  assert.doesNotMatch(await home.text(),/href=["']\/lab\//);
  await anonymous.close();
  console.log("PASS signed-out guard, API denial, no sitemap or public menu links; no browser runtime errors");
} catch(error){
  console.error((await page.locator("body").innerText()).slice(-7000));
  await page.screenshot({path:"doc/assignment-lab/failure.png",fullPage:true});
  throw error;
} finally {await browser.close();}






