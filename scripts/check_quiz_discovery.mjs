// Synthetic, local-only public discovery checks. No model or storage mutations.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import "./register-test-resolver.mjs";
const { translate } = await import("../src/i18n/translate.ts");
let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3217";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local verification only");
const directory = process.env.TEST_ARTIFACT_DIR ?? ".growth-local/owner/quiz-discovery";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const errors = [], checks = [], mutations = [];
const pass = name => { checks.push(name); console.log("PASS " + name); };
await context.route("**/*", async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  if (url.pathname.startsWith("/api/quizzes")) mutations.push(url.pathname);
  const fixtures = {
    "/api/account/summary": { signedIn: false, email: null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 },
    "/api/account/preferences": { preferences: null },
    "/api/analytics": { ok: true },
  };
  await route.fulfill({ status: fixtures[url.pathname] ? 200 : 503, json: fixtures[url.pathname] ?? {} });
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", error => errors.push(error.message));
const visit = path => page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
const events = () => page.evaluate(() => (window.dataLayer ?? []).map(entry => Array.from(entry)).filter(entry => entry[0] === "event" && entry[1]?.startsWith("quiz_")));
try {
  for (const locale of ["en", "ko", "ur"]) {
    const prefix = locale === "en" ? "" : "/" + locale;
    await visit(prefix || "/");
    await page.waitForFunction(() => document.getElementById("rubricheck-ga4"));
    await page.waitForFunction(() => (window.dataLayer ?? []).some(entry => entry[1] === "quiz_discovery_viewed" && entry[2]?.quiz_placement === "tab"));
    assert.equal((await events()).filter(entry => entry[1] === "quiz_discovery_viewed").length, 1);
    const tab = page.getByRole("tab", { name: translate(locale, "Quiz generator"), exact: true });
    await tab.focus(); await page.keyboard.press("Enter");
    assert.equal(await tab.getAttribute("aria-selected"), "true");
    await page.getByRole("heading", { name: translate(locale, "Turn your study materials into quizzes"), exact: true }).waitFor();
    const sample = page.getByRole("region", { name: translate(locale, "Sample quiz"), exact: true });
    assert.equal(await sample.getByRole("link").count(), 0);
    await sample.getByRole("button", { name: "B 4", exact: true }).click();
    await sample.getByRole("button", { name: "A 3", exact: true }).click();
    const create = sample.getByRole("link", { name: translate(locale, "Create a quiz"), exact: false });
    await create.waitFor();
    assert.equal(await create.getAttribute("href"), prefix + "/quizzes?view=create");
    await sample.getByText(translate(locale, "Sign up for 10 free questions in total."), { exact: true }).waitFor();
    const before = await events();
    assert.equal(before.filter(entry => entry[1] === "quiz_mode_selected").length, 1);
    assert.equal(before.filter(entry => entry[1] === "quiz_sample_answered").length, 1, "changing sample answers is not a new first answer");
    await page.screenshot({ path: join(directory, locale + "-sample-390.png"), fullPage: true });
    await create.click();
    await page.waitForURL("**/quizzes?view=create");
    assert.equal((await events()).filter(entry => entry[1] === "quiz_create_clicked" && entry[2].quiz_placement === "sample").length, 1);
    const guestSample = page.getByRole("region", { name: translate(locale, "Sample · Multiple choice"), exact: true });
    await guestSample.getByRole("button", { name: "A 3", exact: true }).click();
    assert.equal((await events()).filter(entry => entry[1] === "quiz_sample_answered").length, 1, "private pages cannot send discovery events");
  }
  pass("English, Korean and Urdu mobile tabs work with keyboard; answered samples show localized creation and quota, without private-route events");
  for (const locale of ["en", "ko", "ms", "hi", "ur", "vi", "zh"]) {
    const prefix = locale === "en" ? "" : "/" + locale;
    await visit(prefix + "/ai-quiz-generator?email=private-sentinel&quiz=private-sentinel#source");
    await page.waitForFunction(() => (window.dataLayer ?? []).some(entry => entry[1] === "quiz_discovery_viewed" && entry[2]?.quiz_placement === "hero"));
    const sample = page.getByRole("region", { name: translate(locale, "Sample · Multiple choice"), exact: true });
    await sample.getByRole("button", { name: "A 3", exact: true }).click();
    assert.equal(await sample.getByRole("link").getAttribute("href"), prefix + "/quizzes?view=create");
    await page.setViewportSize({ width: 320, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.setViewportSize({ width: 390, height: 844 });
    const recorded = await events();
    assert.equal(JSON.stringify(recorded).includes("private-sentinel"), false);
    assert.ok(recorded.every(entry => ["quiz_surface", "quiz_placement", "page_location", "page_referrer", "page_title"].every(key => Object.hasOwn(entry[2], key))));
  }
  pass("Seven public locales show the sample creation action without overflow at 320px; GA4 event URLs exclude queries and fragments");
  await context.addCookies([{ name: "rubricheck_analytics", value: "denied", url: base }]);
  await visit("/product");
  await page.getByRole("tab", { name: "Quiz generator", exact: true }).click();
  await page.getByRole("region", { name: "Sample quiz", exact: true }).getByRole("button", { name: "A 3", exact: true }).click();
  assert.deepEqual(await events(), []);
  assert.equal(await page.locator("#rubricheck-ga4").count(), 0);
  assert.deepEqual(mutations, []);
  assert.deepEqual(errors, []);
  pass("Opted-out interactions remain usable and emit no GA4 events; no quiz, source, billing or model mutations occurred");
  writeFileSync(join(directory, "results.json"), JSON.stringify({ checks, errors, apiMode: "mocked public APIs; GA4 script blocked; local dataLayer events inspected" }, null, 2));
} finally { await browser.close(); }
