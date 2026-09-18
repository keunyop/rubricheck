import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let playwrightModule = process.env.PLAYWRIGHT_MODULE;
if (!playwrightModule && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) playwrightModule = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
const modulePath = playwrightModule && (playwrightModule.endsWith(".mjs") || playwrightModule.endsWith(".js") ? playwrightModule : join(playwrightModule, "index.mjs"));
const playwright = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const { chromium } = playwright.default ?? playwright;
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Use a local server.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let email = "student@example.com", failSubmit = true, failInbox = false;
let inbox = [];
let submitted = 0;
await context.route("**/api/**", async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  let json = {}, status = 200;
  if (path === "/api/account/summary") json = { signedIn: Boolean(email), email, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/trial") json = { used: false, pending: false, result: null };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/workspace") json = { projects: [], assignments: [] };
  else if (path === "/api/account/logout") { email = ""; json = { ok: true }; }
  else if (path === "/api/feedback") {
    submitted++;
    if (failSubmit) { status = 503; json = { message: "Your feedback could not be sent. Please try again." }; }
    else {
      const body = request.postDataJSON();
      inbox.unshift({ ...body, id: "feedback-" + submitted, createdAt: new Date().toISOString(), accountEmail: email || null, replyEmail: body.replyEmail || null });
      json = { ok: true };
    }
  } else if (path === "/api/admin/dashboard") json = { summary: {}, subscribers: [] };
  else if (path === "/api/admin/feedback") {
    if (failInbox) { status = 503; json = { message: "Unable to load feedback. Please try again." }; }
    else {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      json = { items: inbox.slice(offset, offset + 25), nextOffset: inbox.length > offset + 25 ? offset + 25 : null };
    }
  } else throw Error("Unexpected API " + path);
  await route.fulfill({ status, json });
});
const pass = name => console.log("PASS " + name);
try {
  await page.goto(base);
  const sidebar = page.locator("aside[aria-label=Sidebar]");
  const account = page.getByRole("dialog", { name: "Account menu", exact: true });
  await sidebar.getByRole("button", { name: "Open account menu" }).click();
  assert.equal(await account.getByRole("link", { name: "Admin", exact: true }).count(), 0);
  assert.equal(await account.getByRole("link", { name: "Billing and refunds" }).getAttribute("href"), "/billing/manage");
  await account.getByRole("button", { name: "Pricing", exact: true }).waitFor();
  await account.getByRole("button", { name: "Log out", exact: true }).waitFor();
  await page.screenshot({ path: ".next/feedback-account-desktop.png" });
  await page.keyboard.press("Escape");
  assert.equal(await account.isVisible(), false);
  assert.equal(await sidebar.getByRole("button", { name: "Open account menu" }).evaluate(el => el === document.activeElement), true);
  pass("sidebar account menu, links, admin visibility, Escape and focus restoration");

  await sidebar.getByRole("button", { name: "Open account menu" }).click();
  await account.getByRole("button", { name: "Pricing", exact: true }).click();
  await page.waitForURL("**/pricing");
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  await page.getByRole("dialog", { name: "Share your feedback" }).waitFor();
  await page.keyboard.press("Escape");
  await page.goto(base);
  await sidebar.getByRole("button", { name: "Open account menu" }).waitFor();
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  let feedback = page.getByRole("dialog", { name: "Share your feedback" });
  assert.equal(await feedback.getByLabel("Email (optional)").inputValue(), email);
  assert.equal(await feedback.getByRole("button", { name: "Send feedback", exact: true }).isDisabled(), true);
  await feedback.getByLabel("Your feedback", { exact: true }).fill("The mobile menu feels much easier to reach.\nPlease add more project colors.");
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).click();
  await feedback.getByRole("alert").waitFor();
  assert.match(await feedback.getByLabel("Your feedback", { exact: true }).inputValue(), /project colors/);
  failSubmit = false;
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).click();
  await page.getByRole("dialog", { name: "Thanks for your feedback" }).waitFor();
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].page, "/");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  pass("home and pricing use internal feedback; errors preserve input; success stores the message");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const toggle = page.getByRole("button", { name: "Open sidebar", exact: true }).filter({ visible: true });
  const before = await toggle.boundingBox();
  assert.ok(before.width >= 44 && before.height >= 44 && before.y > 700);
  await page.screenshot({ path: ".next/feedback-home-mobile.png" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const after = await toggle.boundingBox();
  assert.equal(before.y, after.y);
  await toggle.click();
  const drawer = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await drawer.getByRole("button", { name: "Open account menu" }).click();
  await account.waitFor();
  await page.screenshot({ path: ".next/feedback-account-mobile.png" });
  await page.keyboard.press("Escape");
  assert.equal(await drawer.isVisible(), true);
  await drawer.getByRole("button", { name: "Open account menu" }).click();
  await account.getByRole("button", { name: "Log out" }).click();
  await sidebar.getByText("Log in to see your assignments.").waitFor({ state: "attached" });
  assert.equal(await drawer.isVisible(), false);
  pass("mobile floating button stays in reach, nested menu closes correctly and logout resets account");

  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  feedback = page.getByRole("dialog", { name: "Share your feedback" });
  assert.equal(await feedback.getByLabel("Email (optional)").inputValue(), "");
  await feedback.getByLabel("Your feedback", { exact: true }).fill("Guest feedback");
  await feedback.getByLabel("What is your feedback about?").selectOption("issue");
  await page.screenshot({ path: ".next/feedback-modal-mobile.png" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(inbox[0].accountEmail, null);
  assert.equal(inbox[0].replyEmail, null);
  pass("mobile guests can submit without an email and the form fits the viewport");

  email = "kylee1112@hotmail.com";
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await sidebar.getByRole("button", { name: "Open account menu" }).click();
  assert.equal(await account.getByRole("link", { name: "Admin", exact: true }).getAttribute("href"), "/admin");
  await context.addCookies([{ name: "admin_secret", value: process.env.TEST_ADMIN_SECRET ?? "local-feedback-browser-test", url: base }]);
  await account.getByRole("link", { name: "Admin", exact: true }).click();
  await page.waitForURL("**/admin");
  const adminInbox = page.getByRole("region", { name: "Feedback inbox" });
  await adminInbox.getByText("Guest feedback", { exact: true }).waitFor();
  await adminInbox.getByText("Guest", { exact: true }).waitFor();
  assert.equal(await adminInbox.locator("article").count(), 2);
  for (let i = 0; i < 26; i++) inbox.push({ ...inbox[0], id: "older-" + i, message: "Older feedback " + i });
  await adminInbox.getByRole("button", { name: "Refresh feedback" }).click();
  await adminInbox.getByRole("button", { name: "Load older feedback" }).waitFor();
  assert.equal(await adminInbox.locator("article").count(), 25);
  await adminInbox.getByRole("button", { name: "Load older feedback" }).click();
  await adminInbox.getByText("Older feedback 25", { exact: true }).waitFor();
  assert.equal(await adminInbox.locator("article").count(), 28);
  await page.screenshot({ path: ".next/feedback-admin-desktop.png" });
  failInbox = true;
  await adminInbox.getByRole("button", { name: "Refresh feedback" }).click();
  await adminInbox.getByRole("alert").waitFor();
  failInbox = false;
  await adminInbox.getByRole("button", { name: "Try again" }).click();
  await adminInbox.getByRole("alert").waitFor({ state: "hidden" });
  inbox = [];
  await adminInbox.getByRole("button", { name: "Refresh feedback" }).click();
  await adminInbox.getByText("No feedback yet. New messages will appear here.").waitFor();
  pass("admin sees submitted messages, pagination, refresh, retry and empty states");
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
