import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Use a local server.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let email = "student@example.com", unavailable = false, evaluations = 0;
let missingSaved = true;
const fileBytes = Buffer.from("%PDF-original rubric bytes");
let items = [
  { id: "a".repeat(64), name: "Essay.pdf", lastUsedAt: 2000, files: [{ name: "Essay.pdf", size: fileBytes.length, type: "application/pdf" }], text: "Thesis 60 points. Evidence 40 points." },
  { id: "b".repeat(64), name: "Report rubric", lastUsedAt: 1000, files: [], text: "Focus 50 points. Organization 50 points." },
];
let lastRequest;
await context.route("**/api/**", async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  let json = {}, status = 200;
  if (path === "/api/account/summary") json = { signedIn: Boolean(email), email, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/trial") json = { used: false, pending: false, result: null };
  else if (path === "/api/workspace") json = { projects: [], assignments: [] };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/rubrics") {
    if (unavailable) { status = 503; json = { message: "Could not load your rubrics. Try again." }; }
    else if (request.method() === "POST") {
      const body = request.postDataJSON();
      if (body.action === "rename") items.find(item => item.id === body.id).name = body.name;
      else if (body.action === "delete") items = items.filter(item => item.id !== body.id);
      json = { ok: true };
    } else if (url.searchParams.has("file")) {
      await route.fulfill({ contentType: "application/octet-stream", body: fileBytes, headers: { "Content-Disposition": 'attachment; filename="Essay.pdf"' } }); return;
    } else if (url.searchParams.has("id")) json = { rubric: items.find(item => item.id === url.searchParams.get("id")) };
    else json = { rubrics: email === "student@example.com" ? items : [] };
  } else if (path === "/api/evaluate") {
    evaluations++;
    lastRequest = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : request.postData();
    if (missingSaved && lastRequest.rubricSource === "saved") {
      missingSaved = false; evaluations--;
      await route.fulfill({ status: 404, json: { code: "RUBRIC_NOT_FOUND", message: "This rubric is no longer available." } }); return;
    }
    const general = typeof lastRequest === "string" ? lastRequest.includes('name="rubricSource"\r\n\r\ngeneral') : lastRequest.rubricSource === "general";
    json = { title: "My essay", access_tier: "free", overall_range: [70, 80], summary: "Clear focus with room for stronger evidence.", top_improvements: ["Add evidence"],
      ...(general ? { grading_basis: "general" } : {}), criteria: [{ name: "Focus", max_score: 100, estimated_range: [70, 80], feedback: "Explain your evidence.", detailed_breakdown_locked: true }] };
  } else throw Error("Unexpected API " + path);
  await route.fulfill({ status, json });
});
const rubric = () => page.getByRole("heading", { name: "Rubric", exact: true }).locator("../../..");
const assignment = () => page.getByRole("heading", { name: "Assignment", exact: true }).locator("../../..");
const modal = () => page.getByRole("dialog", { name: "My rubrics", exact: true });
const pass = message => console.log("PASS " + message);
try {
  await page.goto(base);
  await page.getByRole("button", { name: "My rubrics", exact: true }).click();
  await modal().getByText("Essay.pdf", { exact: true }).waitFor();
  assert.ok((await modal().innerText()).indexOf("Essay.pdf") < (await modal().innerText()).indexOf("Report rubric"));
  await modal().getByRole("button", { name: "Rename", exact: true }).first().click();
  await modal().getByRole("textbox", { name: "Rubric name" }).fill("English essay");
  await modal().getByRole("button", { name: "Save", exact: true }).click();
  await modal().getByText("English essay", { exact: true }).waitFor();
  const downloadEvent = page.waitForEvent("download");
  await modal().getByRole("button", { name: "Download Essay.pdf", exact: true }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), "Essay.pdf");
  assert.deepEqual(await readFile(await download.path()), fileBytes);
  await page.screenshot({ path: ".next/rubric-library-desktop.png" });
  await modal().getByRole("button", { name: "Use rubric", exact: true }).first().click();
  await rubric().getByRole("heading", { name: "English essay", exact: true }).waitFor();
  assert.equal(await modal().count(), 0);
  await rubric().getByText("View rubric text", { exact: true }).click();
  assert.ok(await rubric().getByText("Thesis 60 points. Evidence 40 points.", { exact: true }).isVisible());
  pass("recent selection, rename, preview, and original file download");

  await assignment().getByRole("button", { name: "Text", exact: true }).click();
  await page.getByPlaceholder("Paste assignment text here").fill("My essay makes a clear argument using relevant supporting evidence.");
  await page.reload();
  await rubric().getByRole("heading", { name: "English essay", exact: true }).waitFor();
  assert.equal(await page.getByPlaceholder("Paste assignment text here").inputValue(), "My essay makes a clear argument using relevant supporting evidence.");
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await page.getByText("This saved rubric is no longer available. Choose another rubric from My rubrics.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  assert.equal(lastRequest.rubricSource, "saved"); assert.equal(lastRequest.rubricId, "a".repeat(64)); assert.equal(lastRequest.rubricText, undefined);
  pass("saved selection and assignment restore; evaluation reuses the saved rubric ID");

  await rubric().getByRole("button", { name: "No rubric", exact: true }).click();
  await page.getByLabel("Assignment instructions", { exact: false }).fill("Compare two approaches with examples.");
  await page.reload();
  assert.equal(await page.getByLabel("Assignment instructions", { exact: false }).inputValue(), "Compare two approaches with examples.");
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  assert.equal(lastRequest.rubricSource, "general"); assert.equal(lastRequest.assignmentInstructions, "Compare two approaches with examples.");
  assert.equal(lastRequest.rubricId, undefined); assert.equal(lastRequest.rubricText, undefined);
  await page.getByText("General criteria", { exact: true }).last().waitFor();
  pass("general criteria, instructions, refresh restoration, and result label");

  unavailable = true;
  await page.getByRole("button", { name: "My rubrics", exact: true }).click();
  await modal().getByRole("alert").waitFor();
  unavailable = false;
  await modal().getByRole("button", { name: "Retry", exact: true }).click();
  await modal().getByText("English essay", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await modal().count(), 0);
  assert.equal(await page.getByRole("button", { name: "My rubrics", exact: true }).evaluate(element => element === document.activeElement), true);
  pass("library outage recovery and keyboard focus return");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "My rubrics", exact: true }).click();
  await modal().getByText("English essay", { exact: true }).waitFor();
  const box = await modal().boundingBox(); assert.ok(box.width < 390 && box.x >= 0);
  assert.equal(await modal().evaluate(element => element.scrollWidth > element.clientWidth), false);
  await page.screenshot({ path: ".next/rubric-library-mobile.png" });
  await modal().getByRole("button", { name: "Close rubric library" }).click();
  pass("mobile modal fits without horizontal overflow");

  email = "other@example.com";
  await page.reload();
  assert.equal(await page.getByRole("heading", { name: "English essay", exact: true }).count(), 0);
  await page.getByRole("button", { name: "My rubrics", exact: true }).click();
  await modal().getByText("Rubrics you use will appear here after a check.").waitFor();
  await modal().getByRole("button", { name: "Close rubric library" }).click();
  pass("account switch clears saved inputs and library rows");

  email = "";
  await page.goto(base + "/essay-rubric-checker");
  await page.getByRole("link", { name: "Check without a rubric", exact: true }).first().click();
  await page.getByRole("heading", { name: "General criteria", exact: true }).waitFor();
  assert.equal(await rubric().getByRole("button", { name: "No rubric", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await rubric().getByRole("button", { name: "File", exact: true }).getAttribute("aria-pressed"), "false");
  assert.ok(await page.getByLabel("Assignment instructions", { exact: false }).isVisible());
  assert.equal(evaluations, 2, "navigation never starts a chargeable check");
  await page.screenshot({ path: ".next/rubric-general-mobile.png" });
  pass("essay landing page opens general grading directly for guests");
  for (const path of ["/rubric-checker", "/ai-rubric-grader", "/assignment-rubric-checker", "/essay-rubric-checker", "/how-to-use-a-rubric-to-check-an-assignment", "/rubric-feedback-tool"]) {
    await page.goto(base + path);
    assert.ok(await page.getByRole("link", { name: "Use a saved rubric", exact: true }).count());
    assert.ok(await page.getByRole("link", { name: "Check without a rubric", exact: true }).count());
  }
  email = "student@example.com";
  await page.goto(base + "/essay-rubric-checker");
  await page.getByRole("link", { name: "Use a saved rubric", exact: true }).click();
  await modal().getByText("English essay", { exact: true }).waitFor();
  await modal().getByRole("button", { name: "Close rubric library" }).click();
  email = "";
  await page.goto(base + "/essay-rubric-checker");
  await page.getByRole("link", { name: "Use a saved rubric", exact: true }).click();
  await page.getByRole("heading", { name: "Log in", exact: true }).waitFor();
  assert.equal(await modal().count(), 0);
  assert.deepEqual(errors, []);
  pass("all six existing guides have working start links; no browser exceptions");
} finally { await browser.close(); }
