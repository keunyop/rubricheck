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
const directory = "doc/verification/ui";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const errors = [], checks = [], dimensions = [];
let signedIn = false, codeRequests = 0, verifyRequests = 0, checkoutRequests = 0;
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  const path = url.pathname;
  let json = {}, status = 200;
  if (path === "/api/account/summary") json = { signedIn, email: signedIn ? "student@example.com" : null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/trial") json = { used: false, pending: false, result: null };
  else if (path === "/api/workspace") json = { projects: [], assignments: [] };
  else if (path === "/api/entitlement/restore/start") { codeRequests++; json = { ok: true }; }
  else if (path === "/api/entitlement/restore/verify") { verifyRequests++; signedIn = true; json = { ok: true, plan: "free" }; }
  else if (path === "/api/evaluate") { status = 429; json = { code: "FREE_LIMIT_REACHED", action: "SHOW_INTERSTITIAL", freeLimit: 3 }; }
  else if (path.startsWith("/api/checkout")) { checkoutRequests++; status = 503; json = { code: "SERVICE_UNAVAILABLE" }; }
  else throw Error("Unexpected API request: " + request.method() + " " + path);
  return route.fulfill({ status, json });
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
const pass = message => { checks.push(message); console.log("PASS " + message); };
async function ready(path = "/") {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (path === "/") await page.waitForFunction(() => !document.querySelector("#rubric-checker fieldset")?.disabled);
}
async function fits() {
  const problems = await page.evaluate(() => {
    const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
    const elements = [...document.querySelectorAll("main, main h1, #rubric-checker section, #rubric-checker button, #rubric-checker textarea, main [role=group]")].filter(visible);
    return elements.filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1;
    }).map(element => element.tagName + ": " + element.textContent.slice(0, 100));
  });
  assert.deepEqual(problems, [], "Visible inputs and controls fit the viewport");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
async function modalWorks(trigger, emailId) {
  await trigger.click();
  const modal = page.getByRole("dialog");
  await modal.waitFor();
  assert.equal(await page.locator(emailId).evaluate(element => document.activeElement === element), true, "Email receives initial focus");
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await modal.evaluate(element => element.contains(document.activeElement)), true, "Tab stays in modal");
  }
  await page.keyboard.press("Shift+Tab");
  assert.equal(await modal.evaluate(element => element.contains(document.activeElement)), true);
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true, "Focus returns to opener");
  await trigger.click();
  await page.getByRole("button", { name: "Close login modal", exact: true }).click();
  await modal.waitFor({ state: "hidden" });
}
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await ready();
    await fits();
    const sidebar = page.getByRole("complementary", { name: "Sidebar", exact: true });
    if (width >= 768) {
      const sidebarBox = await sidebar.boundingBox(), mainBox = await page.locator("main").boundingBox();
      assert.ok(mainBox.x >= sidebarBox.x + sidebarBox.width, "Sidebar never overlaps content");
    }
    assert.equal(await page.locator(".skip-link").evaluate(element => element.getBoundingClientRect().bottom < 0), true, "Skip link hidden until focused");
    await page.getByRole("group", { name: "Rubric input method" }).getByRole("button", { name: "Text", exact: true }).click();
    await page.getByRole("textbox", { name: "Rubric", exact: true }).fill("Evidence: 100 points");
    await page.getByRole("group", { name: "Assignment input method" }).getByRole("button", { name: "Text", exact: true }).click();
    await page.getByRole("textbox", { name: "Assignment", exact: true }).fill("A draft with supporting evidence.");
    await fits();
    await page.getByRole("group", { name: "Rubric input method" }).getByRole("button", { name: "File", exact: true }).click();
    await page.getByRole("group", { name: "Assignment input method" }).getByRole("button", { name: "File", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    dimensions.push({ width, height: await page.evaluate(() => document.documentElement.scrollHeight), horizontalOverflow: false });
    if ([320, 390, 1440].includes(width)) {
      await page.screenshot({ path: join(directory, "home-" + width + ".png"), fullPage: true });
      await page.screenshot({ path: join(directory, "home-" + width + "-viewport.png") });
    }
  }
  pass("Inputs, navigation and buttons fit 320, 390, 768, 1024 and 1440 px; sidebar does not overlap");
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("main").evaluate(element => element === document.activeElement), true);
  pass("Skip to content works by keyboard");

  const rubric = page.getByRole("region", { name: "Rubric", exact: true });
  for (const name of ["Choose File", "Take Photo"]) {
    const picker = page.waitForEvent("filechooser");
    await rubric.getByRole("button", { name, exact: true }).focus();
    await page.keyboard.press("Enter");
    const chooser = await picker;
    if (name === "Choose File") await chooser.setFiles({ name: "rubric.txt", mimeType: "text/plain", buffer: Buffer.from("Evidence: 100 points") });
    else await chooser.setFiles([]);
  }
  assert.equal(await rubric.getByText("rubric.txt", { exact: true }).count(), 1);
  await rubric.getByRole("button", { name: "Remove", exact: true }).click();
  assert.equal(await rubric.getByText("rubric.txt", { exact: true }).count(), 0);
  pass("File and camera pickers open with Enter; selecting and removing a file works");

  const question = page.locator("summary").filter({ hasText: "What can I upload?" });
  await question.focus();
  await page.keyboard.press("Enter");
  assert.equal(await question.evaluate(element => element.parentElement.open), true);
  await page.keyboard.press("Enter");
  assert.equal(await question.evaluate(element => element.parentElement.open), false);
  pass("FAQ expands and collapses by keyboard");

  await page.setViewportSize({ width: 320, height: 480 });
  await modalWorks(page.locator("main").getByRole("button", { name: "Log in", exact: true }), "#main-restore-email");
  await page.locator("main").getByRole("button", { name: "Log in", exact: true }).click();
  const modalBox = await page.getByRole("dialog").boundingBox();
  assert.ok(modalBox.x >= 0 && modalBox.y >= 0 && modalBox.x + modalBox.width <= 320 && modalBox.y + modalBox.height <= 480);
  await page.screenshot({ path: join(directory, "login-mobile.png") });
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@example.com");
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Verification code", exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Verification code", exact: true }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.type("123456");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(codeRequests, 1);
  assert.equal(verifyRequests, 1);
  pass("Login fits a short mobile viewport, traps and restores focus, closes with Esc, and submits email/code with Enter");

  await page.getByRole("button", { name: "Strict Mode", exact: true }).click();
  await page.getByRole("dialog", { name: "Strict Mode is locked" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  pass("Strict Mode upgrade keeps its existing access gate and dismisses with Esc");

  await page.getByRole("group", { name: "Rubric input method" }).getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Rubric", exact: true }).fill("Evidence: 100 points");
  await page.getByRole("group", { name: "Assignment input method" }).getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Assignment", exact: true }).fill("A draft with supporting evidence.");
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Free trial limit reached" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("textbox", { name: "Assignment", exact: true }).inputValue(), "A draft with supporting evidence.");
  pass("Usage-limit dialog closes with Esc and preserves the draft");

  signedIn = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await ready("/pricing");
  await fits();
  await page.getByRole("button", { name: "Annual", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Annual", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Monthly", exact: true }).getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: join(directory, "pricing-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Evaluation Top-Ups", exact: true }).click();
  await fits();
  assert.equal(await page.getByRole("button", { name: "Evaluation Top-Ups", exact: true }).getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: join(directory, "topups-mobile.png"), fullPage: true });
  const topup = page.getByRole("button", { name: "Log in to Top Up", exact: true }).first();
  assert.equal(await topup.isEnabled(), true);
  await modalWorks(topup, "#pricing-restore-email");
  assert.equal(checkoutRequests, 0, "Guests only open login, not checkout");
  await topup.click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@example.com");
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Verification code", exact: true }).fill("123456");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Top up", exact: true }).first().click();
  await page.getByText("Unable to start credit checkout right now. Please try again.").waitFor();
  assert.equal(checkoutRequests, 1);
  assert.equal(await page.getByRole("button", { name: "Top up", exact: true }).first().isEnabled(), true);
  pass("Pricing selection states, guest top-up login, and checkout error/retry remain usable");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("group", { name: "Plan type" }).getByRole("button", { name: "Upgrade to Pro", exact: true }).click();
  await page.screenshot({ path: join(directory, "pricing-desktop.png"), fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync(join(directory, "results.json"), JSON.stringify({ checks, dimensions, browserErrors: errors }, null, 2));
  console.log("All UI browser checks passed.");
} catch (error) {
  await page.screenshot({ path: join(directory, "failure.png"), fullPage: true });
  console.error((await page.locator("body").innerText()).slice(0, 3500));
  throw error;
} finally { await browser.close(); }
