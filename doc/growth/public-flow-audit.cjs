const fs=require('node:fs'); const path=require('node:path');
(async()=>{
 const links=path.join(process.env.LOCALAPPDATA,'ms-playwright','.links');
 const pkg=fs.readdirSync(links).map(n=>fs.readFileSync(path.join(links,n),'utf8').trim()).find(p=>fs.existsSync(p));
 const {chromium}=require(pkg); const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('https://rubricheck.com/api/**',r=>r.request().method()==='GET'?r.continue():r.abort());
 const page=await context.newPage();const result={checkedAt:new Date().toISOString(),pages:[]};
 try {
  for(const slug of ['rubric-checker','ai-rubric-grader','assignment-rubric-checker','essay-rubric-checker','rubric-feedback-tool','how-to-use-a-rubric-to-check-an-assignment','legal/privacy','legal/data-retention']){
   const response=await page.goto('https://rubricheck.com/'+slug,{waitUntil:'domcontentloaded',timeout:45000});
   result.pages.push({slug,status:response.status(),title:await page.title(),text:await page.locator('body').innerText()});
  }
  await page.goto('https://rubricheck.com/',{waitUntil:'networkidle',timeout:45000});
  await page.getByRole('button',{name:'Text',exact:true}).nth(0).click();
  await page.getByRole('button',{name:'Text',exact:true}).nth(1).click();
  await page.locator('textarea').nth(0).fill('Synthetic UI audit rubric: clear claim, evidence, and organization.');
  await page.locator('textarea').nth(1).fill('Synthetic UI audit draft. No evaluation will be requested.');
  result.storageBeforePricing=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('rubricheck')));
  await page.getByRole('link',{name:'Pricing',exact:true}).click();
  await page.waitForURL('**/pricing');
  await page.getByRole('link',{name:/Back to home/}).click();
  await page.waitForURL('https://rubricheck.com/');
  await page.getByRole('button',{name:'Text',exact:true}).nth(0).click();
  await page.getByRole('button',{name:'Text',exact:true}).nth(1).click();
  result.inputsAfterPricing=await page.locator('textarea').evaluateAll(es=>es.map(e=>e.value));
  result.gallery=await page.evaluate(async()=>(await fetch('/api/comparison-images')).json());
 } finally {fs.writeFileSync('doc/growth/evidence/public-flow-observations.json',JSON.stringify(result,null,2));await browser.close();}
 console.log(JSON.stringify({...result,pages:result.pages.map(({text,...rest})=>rest)},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
