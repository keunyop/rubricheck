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
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Only use a local server");
const directory = "doc/verification/saas";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const errors = [], checks = [], dimensions = [], requests = [];
let feedbackAttempts = 0;
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  requests.push(url.pathname);
  const data = {
    "/api/account/summary": { signedIn: false, email: null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 },
    "/api/account/preferences": { preferences: null },
    "/api/entitlement": { plan: "free", status: "needs_restore" },
    "/api/trial": { used: false, pending: false, result: null },
    "/api/workspace": { projects: [], assignments: [] },
    "/api/comparison-images": { images: [] },
  };
  if (url.pathname === "/api/feedback") {
    feedbackAttempts++;
    const payload = route.request().postDataJSON();
    assert.equal(payload.page, "/help");
    assert.equal(payload.replyEmail, "student@example.com");
    assert.equal(payload.category, "issue");
    return route.fulfill(feedbackAttempts === 1 ? { status: 503, json: { message: "Please try again." } } : { json: { ok: true } });
  }
  if (!Object.hasOwn(data, url.pathname)) { errors.push("Unexpected API: " + url.pathname); return route.fulfill({ status: 503, json: {} }); }
  return route.fulfill({ json: data[url.pathname] });
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
const pass = message => { checks.push(message); console.log("PASS " + message); };
async function visit(path) { await page.goto(base + path, { waitUntil: "networkidle" }); await page.evaluate(() => document.fonts.ready); }
async function fits(path, width) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits ${width}px`);
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("#main-content").count(), 1);
  assert.equal(await page.locator("footer").count(), 1);
  dimensions.push({ path, width, overflow: false });
}
try {
  for (const prefix of ["", "/ko", "/ms"]) {
    for (const route of ["/product", "/help"]) {
      await visit(prefix + route);
      assert.equal(await page.locator("html").getAttribute("lang"), prefix.slice(1) || "en");
      assert.equal(await page.locator(`header nav a[aria-current="page"]`).getAttribute("href"), prefix + route);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await fits(prefix + route, width);
        if (prefix !== "/ms" && [390, 1440].includes(width)) await page.screenshot({ path: join(directory, `${prefix.slice(1) || "en"}-${route.slice(1)}-${width}.png`), fullPage: true });
        if (prefix === "/ko" && width === 390) await page.screenshot({ path: join(directory, `ko-${route.slice(1)}-390-viewport.png`) });
      }
    }
  }
  pass("Product and help pages fit 320, 390, 768 and 1440px in English, Korean and Malay, with active navigation and one main/footer");

  await visit("/product");
  await page.getByRole("button", { name: /Argument/ }).focus();
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#sample-criterion-feedback").innerText(), /position is clear/);
  assert.equal(await page.getByRole("button", { name: /Argument/ }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: /Organization/ }).click();
  assert.match(await page.locator("#sample-criterion-feedback").innerText(), /paragraphs progress/);
  await page.getByRole("link", { name: "See how it works" }).click();
  assert.ok(page.url().endsWith("#how-it-works"));
  pass("Illustrative product preview responds to click and keyboard without calling grading or consuming checks");

  await visit("/help");
  await page.getByRole("button", { name: "Account & billing", exact: true }).click();
  assert.equal(await page.locator("details").count(), 3);
  const summary = page.locator("summary").first();
  await summary.focus(); await page.keyboard.press("Enter");
  assert.equal(await summary.evaluate(element => element.parentElement.open), true);
  await page.keyboard.press("Enter");
  assert.equal(await summary.evaluate(element => element.parentElement.open), false);
  await page.getByRole("searchbox").fill("refund");
  assert.equal(await page.locator("details[open]").count(), 1);
  await page.getByRole("searchbox").fill("nonexistent topic zzzz");
  await page.getByRole("heading", { name: "No matching articles" }).waitFor();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  assert.equal(await page.locator("details").count(), 13);
  assert.equal(await page.getByRole("searchbox").inputValue(), "");
  pass("Help filtering, search, keyboard accordions and empty-state reset work");

  await page.getByRole("button", { name: "Contact support", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share your feedback" });
  await dialog.getByRole("combobox").selectOption("issue");
  await dialog.getByRole("textbox", { name: "Your feedback" }).fill("I need help with my upload.");
  await dialog.getByRole("textbox", { name: /Email/ }).fill("student@example.com");
  await dialog.getByRole("button", { name: "Send feedback" }).click();
  await dialog.getByRole("alert").waitFor();
  assert.equal(await dialog.getByRole("textbox", { name: "Your feedback" }).inputValue(), "I need help with my upload.");
  await dialog.getByRole("button", { name: "Send feedback" }).click();
  await page.getByRole("heading", { name: "Thanks for your feedback" }).waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(feedbackAttempts, 2);
  assert.equal(await page.getByRole("button", { name: "Contact support", exact: true }).evaluate(element => element === document.activeElement), true);
  pass("Support uses the existing feedback payload, preserves content after failure, retries successfully and restores focus");

  await visit("/ko/help");
  await page.getByRole("searchbox").fill("업로드");
  assert.ok(await page.locator("details").count() > 0);
  assert.doesNotMatch(await page.locator("main").innerText(), /All topics|Contact support|What happens/);
  await page.locator("footer a[hreflang=ms]").click();
  await page.waitForURL("**/ms/help");
  await page.getByRole("searchbox").fill("bayaran balik");
  assert.ok(await page.locator("details").count() > 0);
  assert.doesNotMatch(await page.locator("main").innerText(), /All topics|Contact support|What happens/);
  pass("Translated help search and language navigation work in Korean and Malay");

  await visit("/");
  await page.waitForFunction(() => !document.querySelector("#rubric-checker fieldset")?.disabled);
  const rubric = page.getByRole("region", { name: "Rubric", exact: true });
  await rubric.locator('input[type="file"]').first().setInputFiles({ name: "rubric.txt", mimeType: "text/plain", buffer: Buffer.from("Evidence: 100 points") });
  await page.getByRole("group", { name: "Assignment input method" }).getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Assignment", exact: true }).fill("My draft stays here while I read help.");
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("navigation", { name: "Product and support" }).getByRole("link", { name: /Help center/ }).click();
  const popup = await popupPromise; await popup.waitForLoadState("networkidle");
  assert.ok(popup.url().endsWith("/help"));
  await popup.close();
  assert.equal(await rubric.locator('input[type="file"]').first().evaluate(element => element.files[0].name), "rubric.txt");
  assert.equal(await page.getByRole("textbox", { name: "Assignment", exact: true }).inputValue(), "My draft stays here while I read help.");
  pass("Opening help preserves the active workspace text and uploaded file");

  for (const path of ["/pricing", "/legal/privacy", "/how-to-use-a-rubric-to-check-an-assignment"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(path); await fits(path, 390);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator("a.skip-link").evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("main").evaluate(element => element === document.activeElement), true);
  }
  pass("Pricing, guide and policy pages share navigation, footer and a working keyboard skip link");
  assert.equal(requests.some(path => /\/api\/(grade|evaluate|checkout)/.test(path)), false);
  assert.deepEqual(errors, []);
  writeFileSync(join(directory, "results.json"), JSON.stringify({ checks, dimensions, browserErrors: errors, mockedApi: true, feedbackAttempts }, null, 2));
} finally { await browser.close(); }
