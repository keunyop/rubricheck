import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Use a local server.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let signedIn = false, used = false, evaluations = 0, claims = 0, failNext = true, failClaim = true;
const preview = { guest_preview: true, title: "My essay", overall_range: [70, 80], summary: "Your argument is clear, but it needs better evidence." };
const result = { ...preview, guest_preview: undefined, evaluation_id: "33f33715-5c6a-4f84-bb24-79cff24e3171", access_tier: "free", top_improvements: ["Use a credible source"],
  criteria: [{ name: "Evidence", max_score: 100, score: 75, estimated_range: [70, 80], feedback: "Only signed-in users see this criterion.", detailed_breakdown_locked: true }] };
await context.route("**/api/**", async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  let json = {}, status = 200;
  if (path === "/api/account/summary") json = { signedIn, email: signedIn ? "student@example.com" : null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/trial" && req.method() === "GET") json = { used, pending: false, result: used && !signedIn ? preview : null };
  else if (path === "/api/trial") {
    claims++;
    if (failClaim) { failClaim = false; status = 503; json = { message: "Could not open your preview. Please retry." }; }
    else json = { result, mode: "standard" };
  }
  else if (path === "/api/evaluate") {
    evaluations++;
    if (failNext) { failNext = false; status = 504; json = { code: "OPENAI_TIMEOUT", message: "Please retry." }; }
    else { assert.equal(used, false); used = true; json = preview; }
  }
  else if (path === "/api/entitlement/restore/start") json = { ok: true };
  else if (path === "/api/entitlement/restore/verify") { signedIn = true; json = { ok: true, status: "signed_in", plan: "free" }; }
  else if (path === "/api/workspace") json = req.method() === "GET" ? { projects: [], assignments: [] } : { ok: true };
  else if ((path.startsWith("/api/evaluations/") || path.startsWith("/api/workspace/assignments/"))) json = { result, mode: "standard" };
  else throw Error("Unexpected API: " + path);
  await route.fulfill({ status, json });
});
const pass = message => console.log("PASS " + message);
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Get my free summary", exact: true }).waitFor();
  await page.getByText("3 free checks · No card required", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Try a sample", exact: true }).click();
  const sample = page.getByRole("region", { name: "Sample evaluation", exact: true });
  await sample.waitFor();
  await sample.getByRole("region", { name: "Sample essay" }).waitFor();
  await sample.getByRole("region", { name: "Sample rubric" }).waitFor();
  await sample.getByRole("heading", { name: "Evaluation Summary" }).waitFor();
  assert.equal(await page.locator("#rubric-checker").isVisible(), false);
  assert.equal(evaluations, 0);
  await page.screenshot({ path: ".next/guest-sample-desktop.png", fullPage: false });
  pass("sample opens essay, rubric and prepared result without an evaluation");
  await sample.getByRole("button", { name: "Try your own assignment", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).nth(1).click();
  await page.getByPlaceholder("Paste rubric text here").fill("Evidence: 100 points.");
  await page.getByPlaceholder("Paste assignment text here").fill("My own assignment draft.");
  await page.getByRole("button", { name: "Try a sample", exact: true }).click();
  await sample.getByRole("button", { name: "Try your own assignment", exact: true }).click();
  assert.equal(await page.getByPlaceholder("Paste assignment text here").inputValue(), "My own assignment draft.");
  pass("switching to sample preserves the user's draft");
  await page.getByRole("button", { name: "Get my free summary", exact: true }).click();
  await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const summary = page.getByRole("region", { name: "Your evaluation preview" });
  await summary.waitFor();
  assert.equal(evaluations, 2);
  assert.equal(await page.getByText("Only signed-in users see this criterion.").count(), 0);
  assert.equal(await summary.getByText("Top Improvements", { exact: true }).count(), 0);
  await summary.getByRole("button", { name: "Sign up to see criterion feedback", exact: true }).waitFor();
  pass("failed evaluation can retry; guest receives only Evaluation Summary");
  await page.reload();
  await summary.waitFor();
  assert.equal(evaluations, 2);
  await page.getByRole("button", { name: "Sign up for 3 free checks", exact: true }).waitFor();
  pass("reload restores summary and keeps the preview consumed");
  await page.setViewportSize({ width: 390, height: 844 });
  await summary.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: ".next/guest-summary-mobile.png", fullPage: false });
  pass("mobile summary and signup CTA fit the viewport");
  await summary.getByRole("button", { name: "Sign up to see criterion feedback", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill("student@example.com");
  await dialog.getByRole("button", { name: /Send/ }).click();
  await dialog.getByPlaceholder("123456").fill("123456");
  await dialog.getByRole("button", { name: /Verify/ }).click();
  await page.getByText("Could not open your preview. Please retry.", { exact: true }).waitFor();
  await summary.getByRole("button", { name: "Open criterion feedback", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  await page.getByText("Only signed-in users see this criterion.").filter({ visible: true }).waitFor();
  assert.equal(evaluations, 2); assert.equal(claims, 2);
  assert.equal(await summary.count(), 0);
  assert.ok(page.url().includes("evaluation_id="));
  pass("signup and retry recover original criterion feedback without another evaluation");
  await page.reload();
  await page.getByText("Only signed-in users see this criterion.").filter({ visible: true }).waitFor();
  assert.equal(claims, 2); assert.equal(evaluations, 2);
  pass("claimed evaluation survives reload using existing account recovery");
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

