import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const dir = "doc/verification/i18n";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const errors = [], checks = [];
let email = "student@example.com", preferences = null, saves = 0, failSave = false, failTranslation = false, evaluations = 0;
const id = "88888888-8888-4888-8888-888888888888";
let savedResult = { evaluation_id: id, language: "ko", title: "My essay", access_tier: "free", overall_range: [70, 80], summary: "주장은 명확하지만 근거를 보강해야 합니다.", top_improvements: ["신뢰할 수 있는 자료를 추가하세요."], criteria: [{ name: "Argument", score: 75, rationale: "주장이 명확합니다.", max_score: 100, estimated_range: [70, 80], feedback: "자료를 추가하고 주장과의 관계를 설명하세요.", evidence: ["Schools should start later."], detailed_breakdown_locked: true }] };
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!path.startsWith("/api/")) return route.continue();
  let json = {}, status = 200;
  if (path === "/api/account/summary") json = { signedIn: Boolean(email), email, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/account/preferences") {
    if (request.method() === "PUT") {
      saves++;
      if (failSave) status = 503;
      else preferences = request.postDataJSON();
    }
    json = { preferences };
  }
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/trial") json = { used: false, pending: false, result: null };
  else if (path === "/api/workspace") json = { projects: [{ id: "77777777-7777-4777-8777-777777777777", name: "History essay", createdAt: 1000 }], assignments: evaluations ? [{ id, title: "My essay", projectId: null, createdAt: 1000, mode: "standard", overallRange: [70, 80] }] : [] };
  else if (path === "/api/evaluate") { evaluations++; assert.equal(request.postDataJSON().resultLanguage, "ko"); json = savedResult; }
  else if (path === "/api/evaluations/translate") {
    const { language, evaluationId } = request.postDataJSON(); assert.equal(evaluationId, id);
    if (failTranslation) { status = 503; json = { message: "Could not translate this result. Your original result is unchanged. Try again." }; }
    else json = { result: { ...savedResult, language, summary: language === "ms" ? "Hujah jelas, tetapi bukti perlu diperkukuh." : "The argument is clear, but needs stronger evidence.", top_improvements: ["Tambahkan sumber yang boleh dipercayai."], criteria: savedResult.criteria.map(item => ({ ...item, rationale: "Hujah jelas.", feedback: "Tambahkan sumber untuk menyokong hujah." })) } };
  }
  else if (path === "/api/evaluations/" + id) json = { result: savedResult, mode: "standard" };
  else if (path === "/api/account/logout") { email = ""; json = { ok: true }; }
  else throw Error("Unexpected API: " + path);
  return route.fulfill({ status, json });
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", error => errors.push(error.message));
const pass = text => { checks.push(text); console.log("PASS " + text); };
try {
  for (const [locale, headline] of [["en", "Rubric Checker for Essays and Assignments"], ["ko", "제출 전, 채점 기준에 맞춰 과제를 점검하세요"], ["ms", "Semak esei dan tugasan anda berdasarkan rubrik"]]) {
    const path = locale === "en" ? "/" : "/" + locale;
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('<html lang="' + locale + '"'), path + " server lang");
    assert.ok(html.includes(headline), path + " server headline");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    assert.equal(new URL(canonical).pathname, path, path + " canonical");
    for (const lang of ["en", "ko", "ms", "x-default"]) assert.ok(html.toLowerCase().includes('hreflang="' + lang + '"'));
  }
  pass("Three localized home pages render their language, content and SEO on the server");
  await page.goto(base);
  await page.getByRole("button", { name: "Open account menu" }).click();
  let dialog = page.getByRole("dialog", { name: "Account menu" });
  await dialog.getByLabel("Site language", { exact: true }).selectOption("en");
  await dialog.getByLabel("Grading result language").selectOption("ko");
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] select')].some(select => select.value === 'ko' && !select.disabled));
  assert.equal(await dialog.getByRole("button", { name: "Save languages" }).count(), 0);
  assert.equal(await dialog.getByText("Saved to your account for your next visit.").count(), 0);
  const billingPosition = await dialog.getByRole("link", { name: "Billing and refunds" }).boundingBox();
  const languagePosition = await dialog.getByLabel("Site language", { exact: true }).boundingBox();
  assert.ok(languagePosition.y > billingPosition.y + billingPosition.height);
  assert.deepEqual(preferences, { siteLanguage: "en", resultLanguage: "ko" });
  await page.keyboard.press("Escape");
  pass("Language selectors follow Billing and refunds and save automatically without a save button or explanatory copy");
  await page.reload();
  await page.getByRole("button", { name: "Open account menu" }).click();
  dialog = page.getByRole("dialog", { name: "Account menu" });
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] select')].some(select => select.value === 'ko'));
  assert.equal(await dialog.getByLabel("Grading result language").inputValue(), "ko");
  await page.keyboard.press("Escape");
  pass("Saved account language is restored on the next visit");
  await page.locator('[aria-label="Rubric input method"]').getByRole("button", { name: "Text", exact: true }).click();
  await page.locator('[aria-label="Assignment input method"]').getByRole("button", { name: "Text", exact: true }).click();
  await page.getByPlaceholder("Paste rubric text here").fill("Argument 100 points: use clear reasoning and evidence.");
  await page.getByPlaceholder("Paste assignment text here").fill("Schools should start later. Students need sleep to learn well.");
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await page.getByText(savedResult.summary).waitFor();
  assert.equal(evaluations, 1);
  const projectSelect = page.getByLabel("Move assignment to project");
  await projectSelect.waitFor();
  const [projectBox, languageBox] = await page.evaluate(() => {
    const project = document.querySelector('select[aria-label="Move assignment to project"]');
    const language = [...document.querySelectorAll('label')].find(label => label.textContent === "Result language").control;
    // Read both positions in the same frame while the result heading scrolls into view.
    return [project, language].map(element => {
      const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height };
    });
  });
  assert.ok(Math.abs(projectBox.y + projectBox.height / 2 - languageBox.y - languageBox.height / 2) < 2);
  assert.ok(projectBox.x < languageBox.x);
  assert.equal(await page.getByText("This result only. Your account preferences stay the same.").count(), 0);
  pass("Project and result language selectors share the top result row, with project on the left and language on the right");
  await page.getByLabel("Result language", { exact: true }).selectOption("ms");
  await page.getByText("Hujah jelas, tetapi bukti perlu diperkukuh.").waitFor();
  assert.equal(saves, 1);
  assert.equal(preferences.resultLanguage, "ko");
  assert.ok((await page.locator('main').innerText()).includes("70~80"));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("rubricheck_evaluation_result_v1")));
  assert.equal(stored.gradeResult.criteria[0].evidence[0], "Schools should start later.");
  assert.equal(stored.gradeResult.summary, savedResult.summary);
  await page.screenshot({ path: dir + "/result-en-ms.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByLabel("Result language", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: dir + "/result-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass("One-off result translation leaves scores, original quotes and account preferences unchanged");
  failTranslation = true;
  await page.getByLabel("Result language", { exact: true }).selectOption("en");
  await page.getByRole("alert").filter({ hasText: "Could not translate this result" }).waitFor();
  await page.getByText("Hujah jelas, tetapi bukti perlu diperkukuh.").waitFor();
  assert.equal(await page.getByLabel("Result language", { exact: true }).inputValue(), "ms");
  failTranslation = false;
  await page.getByLabel("Result language", { exact: true }).selectOption("ko");
  await page.getByText(savedResult.summary).waitFor();
  pass("Translation failure keeps the last readable result and returning to the original makes no request");
  await page.getByRole("button", { name: "Open account menu" }).click();
  dialog = page.getByRole("dialog", { name: "Account menu" });
  failSave = true;
  await dialog.getByLabel("Site language", { exact: true }).selectOption("ko");
  await dialog.getByRole("alert").waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await dialog.getByLabel("Site language", { exact: true }).inputValue(), "en");
  failSave = false;
  await dialog.getByLabel("Site language", { exact: true }).selectOption("ko");
  await page.getByRole("heading", { name: "제출 전, 채점 기준에 맞춰 과제를 점검하세요" }).waitFor();
  assert.ok((await page.locator("textarea").evaluateAll(nodes => nodes.map(node => node.value))).includes("Schools should start later. Students need sleep to learn well."));
  await page.getByText(savedResult.summary).waitFor();
  await page.screenshot({ path: dir + "/account-ko-desktop.png" });
  await page.keyboard.press("Escape");
  pass("Failed preference saves do not apply; successful saves translate the page without losing the session");
  for (const locale of ["ko", "ms"]) {
    preferences = { siteLanguage: locale, resultLanguage: "ko" };
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(base + "/" + locale);
    await page.locator(`aside button[aria-label="${locale === "ko" ? "계정 메뉴 열기" : "Buka menu akaun"}"]`).waitFor({ state: "attached" });
    const sidebarName = locale === "ko" ? "사이드바 열기" : "Buka bar sisi";
    await page.getByRole("button", { name: sidebarName, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: locale === "ko" ? "계정 메뉴 열기" : "Buka menu akaun" }).click();
    await page.getByLabel(locale === "ko" ? "사이트 언어" : "Bahasa laman", { exact: true }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false);
    await page.screenshot({ path: dir + "/account-" + locale + "-mobile.png" });
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  }
  pass("Korean and Malay settings remain usable on 375 px mobile screens with no horizontal overflow");
  email = ""; preferences = null;
  await page.goto(base + "/ms");
  await page.getByRole("button", { name: "Buka bar sisi", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tetapan bahasa", exact: true }).click();
  await page.getByLabel("Bahasa laman", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Simpan bahasa", exact: true }).count(), 0);
  pass("Guests can discover language settings from the sidebar");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/ms/rubric-checker");
  assert.equal(await page.locator("html").getAttribute("lang"), "ms");
  await page.locator('a[href="/ms"]').first().click();
  await page.getByRole("heading", { name: "Semak esei dan tugasan anda berdasarkan rubrik" }).waitFor();
  email = "student@example.com"; preferences = { siteLanguage: "ko", resultLanguage: "ms" };
  await page.goto(base + "/ms/rubric-checker");
  await page.waitForURL(base + "/ko/rubric-checker");
  await page.waitForFunction(() => document.documentElement.lang === "ko");
  assert.ok(/[가-힣]/.test(await page.locator("h1").innerText()));
  pass("Public guide navigation and restored account language load matching server-rendered content");
  assert.deepEqual(errors, []);
  writeFileSync(dir + "/results.json", JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
