import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = modulePath ? await import(pathToFileURL(modulePath).href) : await import("playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
const id = "ae7f951b-1810-4f55-90c2-029899442ff1";
const free = {
  evaluation_id: id, title: "Recovery test assignment", access_tier: "free",
  overall_range: [60, 70], summary: "Original assignment summary.",
  top_improvements: ["Improve evidence", "Explain the argument", "Review the conclusion"],
  criteria: [{ name: "Evidence", max_score: 100, score: 65, rationale: "Add supporting evidence.",
    estimated_range: [60, 70], feedback: "Add supporting evidence.", detailed_breakdown_locked: true }],
};
const paid = { ...free, access_tier: "topup", criteria: [{ ...free.criteria[0],
  detailed_breakdown: "Use a cited source in paragraph two.\nExplain how it supports the argument.",
  detailed_breakdown_locked: false, example_revisions: ["Add a source and explain its relevance."] }] };
const browser = await chromium.launch({ headless: true });
const report = [];
async function scenario(name, run) {
  if (process.env.TEST_SCENARIO && !name.includes(process.env.TEST_SCENARIO)) return;
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const state = { confirmations: 0, upgrades: 0, evaluations: 0, checkouts: [], failUpgrade: false, pending: false };
  await context.route("**/api/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    let json = {};
    let status = 200;
    if (pathname === "/api/account/summary") json = { signedIn: true, email: "test@example.com", plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
    else if (pathname === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
    else if (pathname === "/api/comparison-images") json = { images: [] };
    else if (pathname === "/api/evaluate") { state.evaluations++; json = free; }
    else if (pathname === "/api/checkout" || pathname === "/api/checkout/credits") {
      state.checkouts.push(route.request().postDataJSON());
      json = { url: base + "/?checkout_session_id=cs_test_recovery&evaluation_id=" + id };
    } else if (pathname === "/api/checkout/confirm") {
      state.confirmations++;
      json = state.pending ? { ok: false, status: "pending", mode: "credits" } : { ok: true, mode: "credits", evaluationId: id, creditsAdded: 25 };
    } else if (pathname === "/api/evaluations/upgrade") {
      state.upgrades++;
      status = state.failUpgrade ? 503 : 200;
      json = state.failUpgrade ? { code: "UPGRADE_FAILED" } : { result: paid, mode: "standard" };
    } else if (pathname === "/api/evaluations/" + id) json = { result: state.upgrades && !state.failUpgrade ? paid : free, mode: "standard" };
    else throw new Error("Unexpected API request: " + pathname);
    await route.fulfill({ status, json });
  });
  try {
    await run(page, context, state);
    assert.deepEqual(errors, []);
    report.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    report.push({ name, passed: false, error: String(error) });
    console.error(JSON.stringify({ url: page.url(), state, body: (await page.locator("body").innerText()).slice(0, 4500) }));
    await page.screenshot({ path: ".recovery-browser-failure.png", fullPage: true });
    throw error;
  } finally { await context.close(); }
}
async function fillText(page) {
  await page.goto(base);
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).nth(1).click();
  await page.getByPlaceholder("Paste rubric text here").fill("Evidence 60 points. Analysis 40 points.\n루브릭");
  await page.getByPlaceholder("Paste assignment text here").fill("This is the original draft.\nDo not lose this.");
}
async function assertText(page) {
  assert.equal(await page.getByPlaceholder("Paste rubric text here").inputValue(), "Evidence 60 points. Analysis 40 points.\n루브릭");
  assert.equal(await page.getByPlaceholder("Paste assignment text here").inputValue(), "This is the original draft.\nDo not lose this.");
}
async function seedResult(page) {
  await page.evaluate(result => sessionStorage.setItem("rubricheck_evaluation_result_v1", JSON.stringify({ gradeResult: result, resultMode: "standard", savedAt: Date.now() })), free);
}
try {
  await scenario("text survives Pricing, home, reload and browser back", async page => {
    await fillText(page);
    await page.getByRole("link", { name: "Pricing", exact: true }).click();
    await page.waitForURL("**/pricing");
    await page.getByRole("link", { name: "<- Back to home" }).click();
    await page.getByPlaceholder("Paste rubric text here").waitFor();
    await assertText(page);
    await page.reload();
    await page.getByPlaceholder("Paste rubric text here").waitFor();
    await assertText(page);
    await page.getByRole("link", { name: "Pricing", exact: true }).click();
    await page.waitForURL("**/pricing");
    await page.goBack();
    await page.getByPlaceholder("Paste rubric text here").waitFor();
    await assertText(page);
  });
  await scenario("files survive full navigation and remain usable for evaluation", async (page, _context, state) => {
    await page.goto(base);
    await page.locator("#rubric-file-input").setInputFiles({ name: "rubric.txt", mimeType: "text/plain", buffer: Buffer.from("Evidence: 100 points") });
    await page.locator("#assignment-file-input").setInputFiles({ name: "assignment.txt", mimeType: "text/plain", buffer: Buffer.from("Original assignment file.") });
    await page.getByRole("link", { name: "Pricing", exact: true }).click();
    await page.waitForURL("**/pricing");
    await page.getByRole("link", { name: "<- Back to home" }).click();
    await page.getByText("rubric.txt", { exact: true }).waitFor();
    await page.getByText("assignment.txt", { exact: true }).waitFor();
    const [request] = await Promise.all([
      page.waitForRequest(request => request.url().endsWith("/api/evaluate")),
      page.getByRole("button", { name: "Grade my assignment", exact: true }).click(),
    ]);
    assert.match(request.postDataBuffer().toString(), /Original assignment file\./);
    assert.match(request.postDataBuffer().toString(), /Evidence: 100 points/);
    await page.getByText("Original assignment summary.", { exact: true }).waitFor();
    assert.equal(state.evaluations, 1);
  });
  await scenario("checkout resumes the same result, preserves scores, and reload does not repeat checkout", async (page, _context, state) => {
    await fillText(page); await seedResult(page); await page.reload();
    await page.getByText("Original assignment summary.", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Pricing", exact: true }).click();
    await page.waitForURL("**/pricing?evaluation_id=" + id);
    // Exercise the real pricing handler with a mocked checkout URL.
    const buttons = await page.getByRole("button").allTextContents();
    const purchase = page.getByRole("button", { name: "Upgrade to Pro", exact: true }).last();
    if (await purchase.count() === 0) throw new Error("No Pro button: " + buttons.join(", "));
    await purchase.click();
    await page.getByText("Upgrade complete. Detailed feedback for your original assignment is ready.", { exact: true }).waitFor();
    await assertText(page);
    const snapshot = await page.evaluate(() => JSON.parse(sessionStorage.getItem("rubricheck_evaluation_result_v1")));
    assert.equal(snapshot.gradeResult.evaluation_id, id);
    assert.equal(snapshot.gradeResult.access_tier, "topup");
    assert.deepEqual(snapshot.gradeResult.overall_range, free.overall_range);
    assert.equal(state.checkouts.length, 1);
    assert.equal(state.checkouts[0].evaluationId, id);
    assert.equal(state.evaluations, 0);
    const upgrades = state.upgrades;
    await page.reload();
    await page.getByText("Original assignment summary.", { exact: true }).waitFor();
    assert.equal(state.upgrades, upgrades);
    assert.equal(state.checkouts.length, 1);
  });
  await scenario("failed detail and pending payment retain confirmation for a safe refresh retry", async (page, _context, state) => {
    await fillText(page); await seedResult(page);
    state.pending = true;
    await page.goto(base + "/?checkout_session_id=cs_test_recovery&evaluation_id=" + id);
    await page.getByText("Your payment confirmation is still processing. Refresh in a moment to check your top-up.", { exact: true }).waitFor();
    assert.match(page.url(), /checkout_session_id=/);
    assert.equal(state.upgrades, 0);
    state.pending = false; state.failUpgrade = true;
    await page.reload();
    await page.getByText("Purchase confirmed. Detailed feedback is still pending. Refresh to retry without another purchase or credit charge.", { exact: true }).waitFor();
    assert.match(page.url(), /checkout_session_id=/);
    state.failUpgrade = false;
    await page.reload();
    await page.getByText("Upgrade complete. Detailed feedback for your original assignment is ready.", { exact: true }).waitFor();
    assert.doesNotMatch(page.url(), /checkout_session_id=/);
    assert.equal(state.checkouts.length, 0);
    assert.equal(state.evaluations, 0);
  });
  await scenario("checkout cancellation and independent tabs preserve the correct work", async (page, context, state) => {
    await fillText(page); await seedResult(page);
    const other = await context.newPage();
    await other.goto(base);
    await other.getByRole("button", { name: "Text", exact: true }).first().click();
    assert.equal(await other.getByPlaceholder("Paste rubric text here").inputValue(), "");
    await other.getByPlaceholder("Paste rubric text here").fill("Another tab's rubric");
    await page.goto(base + "/?evaluation_id=" + id + "&checkout_canceled=1");
    await page.getByPlaceholder("Paste rubric text here").waitFor();
    await assertText(page);
    await page.getByText("Original assignment summary.", { exact: true }).waitFor();
    assert.equal(state.checkouts.length, 0); assert.equal(state.upgrades, 0);
    await other.close();
  });
  await scenario("blocked browser storage keeps inputs on the page instead of silently losing them", async (page, context) => {
    await context.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    });
    await fillText(page);
    await page.getByRole("link", { name: "Pricing", exact: true }).click();
    await page.getByText("Your browser could not save these inputs. Keep this page open and open Pricing in a new tab.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    await assertText(page);
  });
  await scenario("expired and corrupted drafts do not crash or restore stale input", async page => {
    await page.goto(base);
    await page.evaluate(() => sessionStorage.setItem("rubricheck_evaluation_draft_v1", JSON.stringify({ rubricMode: "text", assignmentMode: "text", rubricText: "stale", assignmentText: "stale", savedAt: Date.now() - 86400001 })));
    await page.reload();
    await page.getByRole("button", { name: "Text", exact: true }).first().click();
    assert.equal(await page.getByPlaceholder("Paste rubric text here").inputValue(), "");
    await page.evaluate(() => sessionStorage.setItem("rubricheck_evaluation_draft_v1", "{bad json"));
    await page.reload();
    await page.getByRole("button", { name: "Text", exact: true }).first().click();
    assert.equal(await page.getByPlaceholder("Paste rubric text here").inputValue(), "");
  });
} finally {
  await browser.close();
  await writeFile(".recovery-browser-results.json", JSON.stringify(report, null, 2));
}

