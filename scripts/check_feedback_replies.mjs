import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local server");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let mode = "reject", sends = 0, ready = true;
const settings = { ready: true, from: "RubriCheck Support <support@mail.rubricheck.com>", replyTo: "operator@example.com" };
const inbox = [
  { id: "11111111-1111-4111-8111-111111111111", category: "issue", message: "My upload failed", page: "/", createdAt: new Date().toISOString(), replyEmail: "customer@example.com", accountEmail: "account@example.com", replies: [] },
  { id: "22222222-2222-4222-8222-222222222222", category: "idea", message: "Account email fallback", page: "/", createdAt: new Date().toISOString(), replyEmail: null, accountEmail: "account@example.com", replies: [] },
  { id: "33333333-3333-4333-8333-333333333333", category: "other", message: "Guest without email", page: "/", createdAt: new Date().toISOString(), replyEmail: null, accountEmail: null, replies: [] },
];
await context.addCookies([{ name: "admin_secret", value: process.env.TEST_ADMIN_SECRET ?? "local-feedback-replies-test", url: base }]);
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  let json = {}, status = 200;
  if (url.pathname === "/api/account/summary") json = { signedIn: true, email: "admin@example.com", plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (url.pathname === "/api/account/preferences") json = { preferences: null };
  else if (url.pathname === "/api/admin/dashboard") json = { summary: {}, subscribers: [] };
  else if (url.pathname === "/api/admin/grading-failures") json = { items: [], nextOffset: null };
  else if (url.pathname === "/api/admin/feedback") json = { items: inbox, nextOffset: null, mailSettings: { ...settings, ready } };
  else if (/^\/api\/admin\/feedback\/[^/]+\/reply$/.test(url.pathname)) {
    sends++;
    const item = inbox.find(item => item.id === url.pathname.split("/")[4]);
    const body = request.postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ["message", "subject"]);
    const reply = { id: "reply-" + body.message, status: mode === "reject" ? "failed" : mode === "unknown" ? "unknown" : "sent", from: settings.from, to: item.replyEmail || item.accountEmail, replyTo: settings.replyTo, ...body, createdAt: new Date().toISOString(), attemptedAt: new Date().toISOString(), sentAt: mode === "ok" ? new Date().toISOString() : null, sentBy: "admin@example.com", providerEmailId: mode === "ok" ? "email-1" : null };
    item.replies = [reply, ...item.replies.filter(old => old.id !== reply.id)];
    if (mode === "ok") json = { reply };
    else { status = 502; json = { code: mode === "reject" ? "FEEDBACK_EMAIL_REJECTED" : "FEEDBACK_DELIVERY_UNKNOWN", message: mode === "reject" ? "The email was not accepted. Check the sender configuration, then retry." : "The delivery result is unknown. Retry the same reply to check it safely.", details: { reply } }; }
  } else throw Error("Unexpected API " + url.pathname);
  await route.fulfill({ status, json });
});
const pass = name => console.log("PASS " + name);
try {
  await page.goto(base + "/admin");
  const inboxRegion = page.getByRole("region", { name: "Feedback inbox" });
  const card = inboxRegion.locator("article").filter({ hasText: "My upload failed" });
  const guest = inboxRegion.locator("article").filter({ hasText: "Guest without email" });
  await card.getByRole("button", { name: "Reply", exact: true }).click();
  let form = card.getByRole("form", { name: "Write a feedback reply" });
  await form.getByText("customer@example.com", { exact: true }).waitFor();
  await form.getByText(settings.replyTo, { exact: true }).waitFor();
  assert.equal(await form.getByRole("button", { name: "Send reply" }).isDisabled(), true);
  assert.equal(await guest.getByRole("button", { name: "Reply", exact: true }).count(), 0);
  await guest.getByText("No email address was provided, so this feedback cannot receive an email reply.").waitFor();
  await form.getByLabel("Reply message", { exact: true }).fill("Thanks for reporting this. The upload bug is fixed.\n<script>window.feedbackUnsafe = true</script>");
  await form.getByRole("button", { name: "Send reply" }).click();
  await card.getByRole("alert").waitFor();
  assert.match(await form.getByLabel("Reply message", { exact: true }).inputValue(), /upload bug is fixed/);
  assert.equal(sends, 1);
  pass("recipient and reply-to are visible; guests cannot be emailed; errors preserve the draft");

  mode = "ok";
  await form.getByRole("button", { name: "Send reply" }).click();
  await card.getByText("Reply sent. The email provider accepted it for delivery.").waitFor();
  assert.equal(await form.count(), 0); assert.equal(sends, 2);
  await card.locator("summary").click();
  await card.getByText("email-1", { exact: true }).waitFor();
  assert.match(await card.locator("details").innerText(), /upload bug is fixed/);
  assert.equal(await page.evaluate(() => window.feedbackUnsafe), undefined);
  await inboxRegion.getByRole("button", { name: "Refresh feedback" }).click();
  await card.locator("summary").getByText("Sent", { exact: true }).waitFor();
  assert.equal(sends, 2);
  pass("successful replies render persisted history, provider ID and literal plain text after refresh");

  const account = inboxRegion.locator("article").filter({ hasText: "Account email fallback" });
  await account.getByRole("button", { name: "Reply", exact: true }).click();
  await account.getByText("account@example.com (account email)", { exact: true }).waitFor();
  await account.getByRole("button", { name: "Close draft" }).click();
  ready = false;
  await inboxRegion.getByRole("button", { name: "Refresh feedback" }).click();
  await inboxRegion.getByText("Email replies need a valid sender, a reply-to inbox and a Resend API key in the server configuration.").waitFor();
  assert.equal(await card.getByRole("button", { name: "Reply", exact: true }).isDisabled(), true);
  ready = true;
  await inboxRegion.getByRole("button", { name: "Refresh feedback" }).click();
  await card.getByRole("button", { name: "Reply", exact: true }).waitFor({ state: "visible" });
  pass("account email fallback and missing configuration are handled explicitly");

  mode = "unknown";
  await card.getByRole("button", { name: "Reply", exact: true }).click();
  form = card.getByRole("form", { name: "Write a feedback reply" });
  await form.getByLabel("Reply message", { exact: true }).fill("Follow-up update");
  await form.getByRole("button", { name: "Send reply" }).click();
  await card.getByRole("alert").waitFor();
  await card.getByText("Delivery unconfirmed", { exact: true }).waitFor();
  assert.equal(await card.getByRole("button", { name: "Reopen reply", exact: true }).isDisabled(), true);
  await inboxRegion.getByRole("button", { name: "Refresh feedback" }).click();
  await card.getByText("Delivery unconfirmed", { exact: true }).waitFor();
  const unconfirmed = card.locator("details").filter({ hasText: "Delivery unconfirmed" });
  await unconfirmed.locator("summary").click();
  mode = "ok";
  await unconfirmed.getByRole("button", { name: "Retry same reply" }).click();
  await card.getByText("Reply sent. The email provider accepted it for delivery.").waitFor();
  assert.equal(sends, 4);
  assert.equal(await card.getByRole("button", { name: "Reply", exact: true }).isDisabled(), false);
  pass("unconfirmed delivery survives refresh, blocks new mail and supports retrying the original reply");

  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole("button", { name: "Reply", exact: true }).click();
  form = card.getByRole("form", { name: "Write a feedback reply" });
  await form.getByLabel("Reply message", { exact: true }).fill("Mobile reply draft");
  await form.scrollIntoViewIfNeeded();
  assert.ok(await form.evaluate(element => element.getBoundingClientRect().width <= innerWidth));
  await page.screenshot({ path: ".next/feedback-replies-mobile.png", fullPage: true });
  assert.ok(await inboxRegion.evaluate(element => element.scrollWidth <= element.clientWidth), "Feedback inbox should not overflow on mobile");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Admin page should fit the mobile viewport");
  assert.deepEqual(errors, []);
  pass("mobile composer fits the screen and the browser reports no application errors");
} finally { await browser.close(); }
