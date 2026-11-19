import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, 'ms-playwright', '.links');
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), 'utf8').trim()).find(existsSync);
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, 'index.mjs');
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3100';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true });
const draft = 'An original draft that explains its claim with evidence and context.';
const incomplete = 'Criterion\nScore\nReasoning\n/2\nEvidence\n/3\nOverall Score\n/20';
const result = { title: 'Evaluation Summary', access_tier: 'free', overall_range: [70, 85], summary: 'Corrected rubric review complete.', top_improvements: ['Explain the connection.'], criteria: [{ name: 'Reasoning', max_score: 20, score: 15, estimated_range: [14, 17], feedback: 'Explain the connection.', detailed_breakdown_locked: true }] };
const words = {
  en: ['Part of the scoring table is missing.', 'conflicting point totals'],
  ko: ['배점표의 일부가 누락', '서로 맞지 않는 총점'],
  ms: ['Sebahagian jadual pemarkahan tiada', 'jumlah markah yang bercanggah'],
  hi: ['अंक तालिका का कुछ भाग गायब', 'कुल अंक परस्पर विरोधी'],
  ur: ['نمبروں کی جدول کا کچھ حصہ', 'کل نمبروں میں تضاد'],
  vi: ['Bảng điểm bị thiếu một phần', 'tổng điểm mâu thuẫn'],
  zh: ['评分表有部分缺失', '总分相互矛盾'],
};
try {
  for (const [locale, localized] of Object.entries(words)) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const browserErrors = [], attempts = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    let code = 'RUBRIC_INCOMPLETE';
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let json = {}, status = 200;
      if (url.pathname === '/api/account/summary') json = { signedIn: true, email: 'test@example.com', plan: 'free', remainingEvaluations: 3, creditsBalance: 0 };
      else if (url.pathname === '/api/account/preferences') json = { preferences: { siteLanguage: locale, resultLanguage: 'en' } };
      else if (url.pathname === '/api/entitlement') json = { plan: 'free', status: 'needs_restore' };
      else if (url.pathname === '/api/workspace') json = { projects: [], assignments: [] };
      else if (url.pathname === '/api/comparison-images') json = { images: [] };
      else if (url.pathname === '/api/trial') json = { used: false, pending: false, result: null };
      else if (url.pathname === '/api/evaluate') {
        attempts.push({ key: request.headers()['idempotency-key'], body: request.postDataJSON() });
        status = code ? 400 : 200;
        json = code ? { code, details: { field: 'rubric' }, requestId: 'scoring-browser-test' } : result;
      } else if (!url.pathname.startsWith('/api/growth/')) throw new Error('Unexpected API: ' + url.pathname);
      await route.fulfill({ status, json });
    });
    try {
      await page.goto(base + (locale === 'en' ? '/workspace' : `/${locale}/workspace`), { waitUntil: 'domcontentloaded', timeout: 120000 });
      const rubric = page.locator('section[aria-labelledby="rubric-input-title"]');
      const assignment = page.locator('section[aria-labelledby="assignment-input-title"]');
      await rubric.locator('[role="group"] button').nth(1).click();
      await assignment.locator('[role="group"] button').nth(1).click();
      await rubric.locator('textarea').fill(incomplete);
      await assignment.locator('textarea').fill(draft);
      const submit = page.locator('#rubric-checker button[type="submit"]');
      const alert = page.getByRole('alert').filter({ hasText: localized[0] });
      await submit.click();
      await alert.waitFor();
      assert.equal(await alert.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await rubric.locator('textarea').inputValue(), incomplete);
      assert.equal(await assignment.locator('textarea').inputValue(), draft);
      assert.equal(attempts.length, 1, 'guidance never auto-retries');
      code = 'RUBRIC_POINTS_CONFLICT';
      await rubric.locator('textarea').fill('Total points: 40; detailed table total: 28.');
      await submit.click();
      await page.getByRole('alert').filter({ hasText: localized[1] }).waitFor();
      assert.equal(attempts.length, 2);
      code = '';
      await rubric.locator('textarea').fill('Reasoning: 20 points. Total: 20.');
      await submit.click();
      await page.getByText(result.summary, { exact: true }).waitFor();
      assert.equal(attempts.length, 3);
      assert.equal(new Set(attempts.map(item => item.key)).size, 3, 'each corrected input has a new reservation key');
      assert.equal(attempts.at(-1).body.assignmentText, draft);
      assert.deepEqual(browserErrors, []);
      console.log(`PASS ${locale}: localized scoring guidance, retained draft, explicit corrected retry and result`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
