import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(existsSync);
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const id = "88888888-8888-4888-8888-888888888888";
const summaries = {
  hi: "तर्क स्पष्ट है, लेकिन उसे अधिक प्रमाण चाहिए।",
  ur: "دلیل واضح ہے، لیکن مزید شواہد درکار ہیں۔",
  vi: "Lập luận rõ ràng nhưng cần thêm bằng chứng.",
  zh: "论点清晰，但需要更多证据。",
};
const result = { evaluation_id: id, language: "hi", title: "My essay", access_tier: "free", overall_range: [70, 80], summary: summaries.hi, top_improvements: ["अधिक प्रमाण जोड़ें।"], criteria: [{ name: "Argument", score: 75, rationale: "तर्क स्पष्ट है।", max_score: 100, estimated_range: [70, 80], feedback: "अधिक प्रमाण जोड़ें।", evidence: ["Schools should start later."], detailed_breakdown_locked: true }] };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(180000);
const errors = [], requested = [];
let preferences = { siteLanguage: "en", resultLanguage: "en" }, evaluationLanguage;
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!path.startsWith("/api/")) return route.continue();
  let json = {};
  if (path === "/api/account/summary") json = { signedIn: true, email: "student@example.com", plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/account/preferences") {
    if (request.method() === "PUT") preferences = request.postDataJSON();
    json = { preferences };
  } else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/trial") json = { used: false, pending: false, result: null };
  else if (path === "/api/workspace") json = { projects: [], assignments: [] };
  else if (path === "/api/evaluate") { evaluationLanguage = request.postDataJSON().resultLanguage; json = result; }
  else if (path === "/api/evaluations/translate") {
    const { language, evaluationId } = request.postDataJSON();
    assert.equal(evaluationId, id);
    requested.push(language);
    json = { result: { ...result, language, summary: summaries[language] } };
  } else if (path === "/api/evaluations/" + id) json = { result, mode: "standard" };
  else throw Error("Unexpected API: " + path);
  await route.fulfill({ json });
});
try {
  await page.goto(base + "/workspace");
  await page.getByRole("button", { name: "Open account menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Account menu" });
  const select = dialog.getByLabel("Grading result language");
  for (const locale of Object.keys(summaries)) {
    await select.selectOption(locale);
    await page.waitForFunction(expected => [...document.querySelectorAll('dialog[open] select')].some(item => item.value === expected && !item.disabled), locale);
    assert.deepEqual(preferences, { siteLanguage: "en", resultLanguage: locale });
  }
  await select.selectOption("hi");
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] select')].some(item => item.value === "hi" && !item.disabled));
  await page.keyboard.press("Escape");
  await page.locator('[aria-label="Rubric input method"]').getByRole("button", { name: "Text", exact: true }).click();
  await page.locator('[aria-label="Assignment input method"]').getByRole("button", { name: "Text", exact: true }).click();
  await page.getByPlaceholder("Paste rubric text here").fill("Argument 100 points: use clear reasoning and evidence.");
  await page.getByPlaceholder("Paste assignment text here").fill("Schools should start later. Students need sleep to learn well.");
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await page.getByText(summaries.hi).waitFor();
  assert.equal(evaluationLanguage, "hi");
  const resultSelect = page.getByLabel("Result language", { exact: true });
  for (const locale of ["ur", "vi", "zh"]) {
    await resultSelect.selectOption(locale);
    const summary = page.getByText(summaries[locale], { exact: true });
    await summary.waitFor();
    assert.equal(await summary.getAttribute("dir"), "auto");
    assert.equal(await summary.getAttribute("lang"), locale);
    assert.equal(await summary.evaluate(element => getComputedStyle(element).direction), locale === "ur" ? "rtl" : "ltr");
    assert.deepEqual(preferences, { siteLanguage: "en", resultLanguage: "hi" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (locale === "ur") await page.screenshot({ path: ".next/result-ur-en-desktop.png", fullPage: true });
  }
  assert.deepEqual(requested, ["ur", "vi", "zh"]);
  await resultSelect.selectOption("ur");
  await page.getByText(summaries.ur).waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await resultSelect.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".next/result-ur-en-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("PASS new grading languages persist independently, reach grading, translate individual results and display Urdu RTL");
} finally {
  await browser.close();
}
