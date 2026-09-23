import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Use a local server.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(60000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let email = "student@example.com", failRead = false, failSave = false, conflict = false, writes = 0;
const assignments = [
  { id: randomUUID(), title: "History essay", projectId: null, createdAt: 2000, mode: "standard", overallRange: [70, 80] },
  { id: randomUUID(), title: "Biology report", projectId: null, createdAt: 1000, mode: "standard", overallRange: [60, 70] },
];
const records = new Map();
const result = item => ({
  evaluation_id: item.id, title: item.title, access_tier: "free", overall_range: item.overallRange,
  summary: "Review the evidence.", top_improvements: ["Add sources."],
  criteria: [{ name: "Evidence", max_score: 100, estimated_range: item.overallRange, feedback: "Add sources.", detailed_breakdown_locked: true }],
});
await context.route("**/api/**", async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  let status = 200, json = {};
  if (path === "/api/account/summary") json = { signedIn: Boolean(email), email, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/trial") json = { used: false, pending: false, result: null };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/account/logout") { email = ""; json = { ok: true }; }
  else if (path === "/api/workspace") json = { projects: [], assignments: email === "student@example.com" ? assignments : [] };
  else if (path.endsWith("/actual-result")) {
    const id = path.split("/").at(-2), item = assignments.find(item => item.id === id);
    if (!item || email !== "student@example.com") { status = 404; json = { message: "Assignment unavailable." }; }
    else if (request.method() === "GET") {
      if (failRead) { status = 503; json = { message: "Could not load your actual result." }; }
      else json = { actualResult: records.get(id) ?? null };
    } else {
      writes++;
      const body = request.postDataJSON(), previous = records.get(id);
      if (failSave) { status = 503; json = { message: "Could not save your actual result." }; }
      else if (conflict || body.expectedRevision !== (previous?.revision ?? null)) { status = 409; json = { message: "This record changed in another tab. Reload the saved record before making changes." }; }
      else if (request.method() === "DELETE") { records.delete(id); json = { actualResult: null }; }
      else if (request.method() === "PUT") {
        const fields = { ...body };
        delete fields.expectedRevision;
        const saved = { ...fields, evaluationId: id, revision: randomUUID(), createdAt: previous?.createdAt ?? Date.now(), updatedAt: Date.now(),
          consentVersion: "actual-results-v1", consentUpdatedAt: Date.now(),
          estimate: previous?.estimate ?? { overallRange: item.overallRange, mode: item.mode, scoringVersion: null, provenance: null } };
        records.set(id, saved); json = { actualResult: saved };
      } else throw Error("Unexpected result mutation");
    }
  } else if (path.startsWith("/api/workspace/assignments/") || path.startsWith("/api/evaluations/")) {
    const item = assignments.find(item => item.id === path.split("/").pop());
    if (!item || email !== "student@example.com") { status = 404; json = { message: "Assignment unavailable." }; }
    else json = { result: result(item), mode: item.mode };
  } else throw Error("Unexpected API " + path);
  await route.fulfill({ status, json });
});
const panel = page.getByRole("region", { name: "Actual score and comments", exact: true });
const sidebar = page.locator("aside[aria-label=Sidebar]");
const personal = () => panel.getByRole("checkbox", { name: /Save to my personal record/ });
const quality = () => panel.getByRole("checkbox", { name: /Allow service quality validation/ });
const publicCase = () => panel.getByRole("checkbox", { name: /Allow an anonymized public case/ });
const save = () => panel.getByRole("button", { name: "Save actual result", exact: true });
const saved = () => panel.getByText("Actual result saved.", { exact: true }).waitFor();
const pass = name => console.log("PASS " + name);

try {
  await page.goto(base);
  await sidebar.getByRole("button", { name: "History essay", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  await panel.getByRole("button", { name: "Add actual score and comments", exact: true }).click();
  await personal().waitFor();
  assert.equal(await personal().isChecked(), false);
  assert.equal(await quality().isChecked(), false);
  assert.equal(await publicCase().isChecked(), false);
  await panel.getByLabel("Actual score (optional)", { exact: true }).fill("17");
  await panel.getByLabel("Maximum score", { exact: true }).fill("20");
  await panel.getByLabel("Course / subject (optional)", { exact: true }).fill("History");
  await panel.getByLabel("Assignment type", { exact: true }).selectOption("essay");
  await panel.getByLabel("Was the graded submission the same draft as this AI check?", { exact: true }).selectOption("same");
  await panel.getByLabel("Assignment comments (optional)", { exact: true }).fill("More evidence next time.");
  await personal().check();
  await save().click(); await saved();
  await panel.getByText("17 / 20 (85%)", { exact: true }).waitFor();
  await panel.getByText("+10 percentage points", { exact: true }).waitFor();
  await panel.getByText("Outside the estimated range by 5 percentage points.", { exact: true }).waitFor();
  assert.equal(records.get(assignments[0].id).consent.publicCase, false);
  assert.equal(await panel.getAttribute("data-html2canvas-ignore"), "true");
  pass("private result saves and compares against the original range on a different score scale");

  await page.reload();
  await panel.getByRole("button", { name: "Add actual score and comments", exact: true }).click();
  await panel.getByText("17 / 20 (85%)", { exact: true }).waitFor();
  assert.equal(await panel.getByLabel("Assignment comments (optional)", { exact: true }).inputValue(), "More evidence next time.");
  await quality().check();
  await save().click(); await saved();
  assert.equal(records.get(assignments[0].id).consent.qualityValidation, true);
  assert.equal(records.get(assignments[0].id).consent.publicCase, false);
  await quality().uncheck();
  await publicCase().check();
  await save().click(); await saved();
  assert.equal(records.get(assignments[0].id).consent.qualityValidation, false);
  assert.equal(records.get(assignments[0].id).consent.publicCase, true);
  await publicCase().uncheck();
  await save().click(); await saved();
  pass("reload restores saved fields and independent optional permissions can be withdrawn");

  const beforeInvalid = writes;
  await panel.getByLabel("Actual score (optional)", { exact: true }).fill("21");
  await save().click();
  assert.equal(writes, beforeInvalid);
  await panel.getByLabel("Actual score (optional)", { exact: true }).fill("16.25");
  failSave = true;
  await save().click();
  await panel.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
  assert.equal(await panel.getByLabel("Actual score (optional)", { exact: true }).inputValue(), "16.25");
  failSave = false;
  await save().click(); await saved();
  await panel.getByText("16.25 / 20 (81.25%)", { exact: true }).waitFor();
  conflict = true;
  await save().click();
  await panel.getByRole("button", { name: "Reload saved record", exact: true }).waitFor();
  assert.equal(await save().isDisabled(), true);
  conflict = false;
  await panel.getByRole("button", { name: "Reload saved record", exact: true }).click();
  await save().waitFor({ state: "visible" });
  await panel.getByLabel("Actual score (optional)", { exact: true }).fill("0");
  await save().click(); await saved();
  await panel.getByText("0 / 20 (0%)", { exact: true }).waitFor();
  pass("invalid scores are blocked; failed saves preserve input; conflicts require reload; zero and decimals work");

  await sidebar.getByRole("button", { name: "Biology report", exact: true }).click();
  failRead = true;
  await panel.getByRole("button", { name: "Add actual score and comments", exact: true }).click();
  await panel.getByRole("button", { name: "Try again", exact: true }).waitFor();
  failRead = false;
  await panel.getByRole("button", { name: "Try again", exact: true }).click();
  await personal().waitFor();
  assert.equal(await panel.getByLabel("Assignment comments (optional)", { exact: true }).inputValue(), "");
  assert.equal(await quality().isChecked(), false);
  assert.equal(await publicCase().isChecked(), false);
  await personal().check();
  await panel.getByLabel("Assignment comments (optional)", { exact: true }).fill("<script>alert('comment')</script> Instructor notes only.");
  await save().click(); await saved();
  await panel.getByText("Comment saved. Add a numeric score to compare results.", { exact: true }).waitFor();
  pass("switching assignments resets state, failed reads retry, and comment-only records render safely");

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".next/actual-result-mobile.png", fullPage: true });
  await panel.getByRole("button", { name: "Delete actual result", exact: true }).click();
  await panel.getByRole("button", { name: "Confirm deletion", exact: true }).click();
  await panel.getByText("Actual result deleted. Your AI evaluation is still saved.", { exact: true }).waitFor();
  assert.equal(records.has(assignments[1].id), false);
  assert.equal(await personal().isChecked(), false);
  assert.equal(await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).count(), 1);
  pass("mobile layout fits and deletion preserves the AI evaluation");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: email, exact: true }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await sidebar.getByText("Log in to see your assignments.", { exact: true }).waitFor();
  assert.equal(await panel.count(), 0);
  email = "other@example.com";
  await page.reload();
  await sidebar.getByText("Your graded assignments appear here.", { exact: true }).waitFor();
  assert.equal(await panel.count(), 0);
  assert.deepEqual(errors, []);
  pass("logout and another account never expose the previous account's actual result");
  console.log("All actual result browser checks passed.");
} catch (error) {
  await mkdir(".next", { recursive: true });
  await page.screenshot({ path: ".next/actual-result-failure.png", fullPage: true });
  console.error((await page.locator("body").innerText()).slice(0, 7000));
  throw error;
} finally { await browser.close(); }
