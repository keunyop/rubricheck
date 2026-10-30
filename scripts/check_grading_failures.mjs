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
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const timestamp = Date.now();
let items = Array.from({ length: 26 }, (_, i) => ({
  id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`, requestId: "request-" + i,
  createdAt: timestamp - i * 1000, expiresAt: timestamp + 7 * 86400000 - i * 1000,
  stage: "rubric_structuring", code: "RUBRIC_STRUCTURE_FAILED", accountEmail: `student${i}@example.com`, mode: "standard", language: "en", captureStatus: i === 1 ? "metadata_only" : "complete",
}));
const privateText = 'Original assignment <script>window.exposed = true</script>\nSecond line.';
const originalBytes = Buffer.from([0, 1, 255, 42]);
let failList = true, expired = false, detailReads = 0, deletes = 0;
await context.addCookies([{ name: "admin_secret", value: process.env.TEST_ADMIN_SECRET ?? "local-grading-failures-test", url: base }]);
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  let json = {}, status = 200;
  if (url.pathname === "/api/admin/grading-failures") {
    if (request.method() === "DELETE") {
      deletes++; items = items.filter(item => item.id !== request.postDataJSON().id); json = { ok: true };
    } else if (url.searchParams.has("id")) {
      detailReads++;
      const item = items.find(item => item.id === url.searchParams.get("id"));
      if (expired || !item) { status = 404; json = { message: "This record has expired or was deleted." }; }
      else if (url.searchParams.has("file")) return route.fulfill({ body: originalBytes, headers: { "content-type": "application/octet-stream", "content-disposition": 'attachment; filename="assignment.pdf"' } });
      else {
        json = { ...item, inputs: { rubricSource: "provided", rubricId: null, rubricText: "Holistic rubric", assignmentText: item.captureStatus === "complete" ? privateText : null, assignmentInstructions: "", extractedRubricText: null, extractedAssignmentText: null },
          files: [{ field: "assignment", name: "assignment.pdf", type: "application/pdf", size: originalBytes.length }], structureModel: "test-model", evaluationModel: "test-model", deployment: "test-revision", captureNote: item.captureStatus === "metadata_only" ? "Collection limit reached; only metadata was retained." : null };
      }
    } else if (failList) { status = 503; json = { message: "Unable to load grading failures. Please retry." }; }
    else {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      json = { items: items.slice(offset, offset + 25), nextOffset: items.length > offset + 25 ? offset + 25 : null };
    }
  } else if (url.pathname === "/api/admin/feedback") json = { items: [], nextOffset: null };
  else if (url.pathname === "/api/admin/dashboard") json = { summary: {}, subscribers: [] };
  else if (url.pathname === "/api/admin/growth") json = { enabled: false };
  else if (url.pathname === "/api/account/summary") json = { signedIn: true, email: "admin@example.com", plan: "free", creditsBalance: 0 };
  else if (url.pathname === "/api/account/preferences") json = { preferences: null };
  else if (url.pathname.startsWith("/api/growth/")) json = { ok: true };
  else throw new Error("Unexpected API: " + url.pathname);
  await route.fulfill({ status, json });
});
const pass = message => console.log("PASS " + message);
try {
  await page.goto(base + "/admin");
  const panel = page.getByRole("region", { name: "Grading failures", exact: true });
  await panel.getByRole("alert").waitFor();
  failList = false;
  await panel.getByRole("button", { name: "Retry loading failures" }).click();
  await panel.getByText("student0@example.com", { exact: false }).waitFor();
  assert.equal(await panel.locator("article").count(), 25);
  assert.equal(detailReads, 0);
  assert.ok(!(await panel.innerText()).includes(privateText));
  await panel.getByRole("button", { name: "Load older failures" }).click();
  await panel.getByText("student25@example.com", { exact: false }).waitFor();
  assert.equal(await panel.locator("article").count(), 26);
  pass("failure inbox recovers from storage errors and paginates metadata without loading originals");

  const first = panel.locator("article").first();
  await first.getByRole("button", { name: "View details" }).click();
  await first.getByText("Original assignment text", { exact: true }).waitFor();
  assert.ok((await first.innerText()).includes(privateText));
  assert.equal(await page.evaluate(() => window.exposed), undefined);
  const downloadPromise = page.waitForEvent("download");
  await first.getByRole("link", { name: "Download original", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "assignment.pdf");
  assert.deepEqual(readFileSync(await download.path()), originalBytes);
  pass("details safely render original text and download exact original file bytes");

  await first.getByRole("button", { name: "Delete record" }).click();
  await first.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(deletes, 0);
  await first.getByRole("button", { name: "Delete record" }).click();
  await first.getByRole("button", { name: "Delete permanently" }).click();
  await panel.getByText("student0@example.com", { exact: false }).waitFor({ state: "hidden" });
  assert.equal(deletes, 1);
  pass("early deletion requires confirmation and refreshes the list");

  await panel.locator("article").first().getByRole("button", { name: "View details" }).click();
  await panel.getByText("Collection limit reached; only metadata was retained.", { exact: true }).waitFor();
  assert.equal(await panel.getByRole("link", { name: "Download original", exact: true }).count(), 0);
  expired = true;
  await panel.locator("article").nth(1).getByRole("button", { name: "View details" }).click();
  await panel.getByText("This record has expired or was deleted.", { exact: false }).waitFor();
  pass("metadata-only and expired records have clear states and no unusable file links");
  expired = false;
  await panel.getByRole("button", { name: "Refresh failures" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByRole("button", { name: "View details" }).first().waitFor();
  assert.equal(await panel.evaluate(element => element.scrollWidth <= element.clientWidth), true);
  await panel.screenshot({ path: ".next/grading-failures-mobile.png" });
  assert.deepEqual(errors, []);
  pass("admin failure panel fits a mobile viewport without browser errors");
} finally { await browser.close(); }
