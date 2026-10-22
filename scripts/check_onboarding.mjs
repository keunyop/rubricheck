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
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3200";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local verification only");
const directory = "doc/verification/onboarding";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
const checks = [], errors = [], requests = [];
let signedIn = false, plan = "free", credits = 0, remaining = 3;
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  requests.push(url.pathname);
  let json = {};
  if (url.pathname === "/api/account/summary") json = { signedIn, email: signedIn ? "student@example.com" : null, plan, remainingEvaluations: remaining, creditsBalance: credits };
  else if (url.pathname === "/api/account/preferences") json = { preferences: null };
  else if (url.pathname === "/api/entitlement") json = { plan, status: plan === "pro" ? "active" : "needs_restore" };
  else if (url.pathname === "/api/trial") json = { used: false, pending: false, result: null };
  else if (url.pathname === "/api/workspace") json = { projects: [], assignments: [] };
  else if (url.pathname === "/api/comparison-images") json = { images: [] };
  else if (url.pathname === "/api/entitlement/restore/start") json = { ok: true };
  else if (url.pathname === "/api/entitlement/restore/verify") { signedIn = true; json = { ok: true, plan }; }
  else { errors.push("Unexpected API: " + url.pathname); return route.fulfill({ status: 503, json: {} }); }
  return route.fulfill({ json });
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
const pass = message => { checks.push(message); console.log("PASS " + message); };
async function home(path = "/workspace") { await page.goto(base + path, { waitUntil: "networkidle" }); await page.waitForFunction(() => !document.querySelector("#rubric-checker fieldset")?.disabled); }
async function fits() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
async function account() {
  const trigger = page.locator("main").getByRole("button", { name: "student@example.com", exact: true });
  await trigger.click(); await page.getByRole("menuitem", { name: "Account settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Account menu", exact: true });
  await dialog.getByRole("heading", { name: "Account settings", exact: true }).waitFor();
  return { dialog, trigger };
}
try {
  await home();
  const guide = page.locator("details").filter({ hasText: "Your first check, in three steps" });
  assert.equal(await guide.getAttribute("open"), "");
  await guide.getByText(/A rubric is your instructor/).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 }); await fits();
    if ([390, 1440].includes(width)) await page.screenshot({ path: join(directory, `home-${width}.png`), fullPage: true });
  }
  await guide.locator("summary").focus(); await page.keyboard.press("Enter");
  assert.equal(await guide.getAttribute("open"), null);
  await page.getByRole("group", { name: "Rubric input method" }).getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Rubric", exact: true }).fill("Evidence: 100 points");
  await page.getByRole("group", { name: "Assignment input method" }).getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Assignment", exact: true }).fill("My first assignment draft.");
  assert.equal(await guide.getAttribute("open"), null);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Assignment", exact: true }).waitFor();
  assert.equal(await guide.getAttribute("open"), null);
  assert.equal(await page.getByRole("textbox", { name: "Assignment", exact: true }).inputValue(), "My first assignment draft.");
  pass("First visit explains rubric, inputs and result; guide is keyboard-collapsible, responsive and stays closed for a restored draft");

  await guide.locator("summary").click();
  await guide.getByRole("button", { name: "Create free account", exact: true }).click();
  await page.getByRole("dialog", { name: "Sign up or log in", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@example.com");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await page.getByRole("textbox", { name: "Verification code", exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify & Log in", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("textbox", { name: "Assignment", exact: true }).inputValue(), "My first assignment draft.");
  assert.equal(requests.filter(path => path === "/api/entitlement/restore/verify").length, 1);
  pass("Free sign-up uses existing email verification and preserves the draft without starting an evaluation or checkout");

  let { dialog, trigger } = await account();
  assert.equal(await dialog.locator("dl dd").allTextContents().then(values => values.join("|")), "Free|3|0");
  await dialog.getByLabel("Site language", { exact: true }).waitFor();
  await dialog.getByRole("link", { name: "Billing and refunds" }).waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 568 }); await fits();
    const box = await dialog.boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 568);
  }
  await page.screenshot({ path: join(directory, "account-390.png") });
  await page.keyboard.press("Escape");
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Open account menu", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Open account menu", exact: true }).evaluate(element => element === document.activeElement), true);
  pass("Header and sidebar share account settings, accurate usage and language controls; mobile dialog fits and restores the correct trigger focus");

  plan = "topup"; credits = 8; remaining = 8; await home();
  ({ dialog } = await account());
  assert.equal((await dialog.locator("dl dd").allTextContents()).join("|"), "Top-up|8|8");
  await page.keyboard.press("Escape");
  plan = "pro"; credits = 2; remaining = null; await home();
  ({ dialog } = await account());
  assert.equal((await dialog.locator("dl dd").allTextContents()).join("|"), "Pro|Unlimited evaluations|2");
  await page.keyboard.press("Escape");
  plan = "free"; credits = null; remaining = null; await home();
  ({ dialog } = await account());
  assert.equal((await dialog.locator("dl dd").allTextContents()).join("|"), "Free|—|—");
  await page.keyboard.press("Escape");
  pass("Account overview distinguishes Free, top-up, Pro and unavailable counts without showing invented balances");

  signedIn = false; plan = "free"; credits = 0; remaining = 3;
  await page.goto(base + "/pricing", { waitUntil: "networkidle" });
  await page.locator("summary").filter({ hasText: "Compare Free, top-ups and Pro" }).click();
  const table = page.getByRole("table", { name: "Plan feature comparison", exact: true });
  assert.deepEqual(await table.getByRole("row", { name: /Improvement priorities/ }).getByRole("cell").allTextContents(), ["1", "3", "3"]);
  assert.deepEqual(await table.getByRole("row", { name: /Strict Mode/ }).getByRole("cell").allTextContents(), ["Not included", "Included", "Included"]);
  assert.deepEqual(await table.getByRole("row", { name: /Rewrite suggestions/ }).getByRole("cell").allTextContents(), ["Not included", "Not included", "Included"]);
  for (const width of [320,390,1440]) { await page.setViewportSize({ width, height: 960 }); await fits(); }
  await page.screenshot({ path: join(directory, "pricing-comparison.png"), fullPage: true });
  pass("Pricing comparison matches feature permissions, explains guest versus signed-in Free, and scrolls within its own region on mobile");

  for (const [locale, guideTitle, comparisonTitle, signupTitle] of [
    ["ko", "처음이라면, 세 단계로 시작하세요", "무료·크레딧·Pro 기능 비교", "무료 계정 만들기"],
    ["ms", "Semakan pertama anda dalam tiga langkah", "Bandingkan Percuma, tambah nilai dan Pro", "Cipta akaun percuma"],
  ]) {
    await context.clearCookies();
    await home("/" + locale + "/workspace");
    const translatedGuide = page.locator("details").filter({ hasText: guideTitle });
    if (await translatedGuide.getAttribute("open") === null) await translatedGuide.locator("summary").click();
    await translatedGuide.getByRole("button", { name: signupTitle, exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 960 }); await fits();
    await page.screenshot({ path: join(directory, `${locale}-home-390.png`), fullPage: true });
    await page.goto(base + "/" + locale + "/pricing", { waitUntil: "networkidle" });
    await page.locator("summary").filter({ hasText: comparisonTitle }).click(); await fits();
    assert.doesNotMatch(await page.locator("details[open]").innerText(), /Included features|Not included|Per purchased pack/);
  }
  pass("New onboarding and plan comparison are translated and usable in Korean and Malay");
  assert.equal(requests.some(path => /\/api\/(evaluate|grade|checkout)/.test(path)), false);
  assert.deepEqual(errors, []);
  writeFileSync(join(directory, "results.json"), JSON.stringify({ checks, errors, mockedApi: true }, null, 2));
} finally { await browser.close(); }
