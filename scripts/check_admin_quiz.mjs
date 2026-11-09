// Local admin UI regression. Private data responses are fixtures; no store writes.
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
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3217";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Only use a local server");
const directory = process.env.TEST_ARTIFACT_DIR ?? ".growth-local/admin-quiz-verification";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(120000);
const errors = [], checks = [];
page.on("pageerror", error => errors.push(error.message));
const pass = label => { checks.push(label); console.log("PASS " + label); };
let fail = false, coverage = "complete", requests = 0;
const owner = "a".repeat(64), quizId = "11111111-1111-4111-8111-111111111111";
const snapshot = () => ({
  generatedAt: "2026-11-04T12:00:00.000Z", coverage, scannedAccounts: 124, scannedRecords: 420,
  totals: { users: 124, quizzes: 248, questions: 1240, attempts: 360, completedAttempts: 270, reviewAttempts: 90 },
  generation: { completed: 248, failed: 3, inProgress: 2, interrupted: 1 },
});
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  assert.equal(request.method(), "GET", "admin review must not mutate records");
  if (url.pathname === "/api/admin/quizzes") {
    requests++;
    if (url.searchParams.get("view") === "list") return route.fulfill({ json: {
      generatedAt: "2026-11-04T12:00:00.000Z", coverage: "complete", scannedAccounts: 1, scannedQuizzes: 1,
      total: 1, offset: 0, limit: 20, items: [{ ownerId: owner, id: quizId, title: "Cell biology", createdAt: 1_794_000_000_000, questionCount: 1, language: "en", difficulty: "standard", purpose: "concepts", sourceNames: ["Biology notes.pdf"] }],
    } });
    if (url.searchParams.get("view") === "detail") return route.fulfill({ json: {
      ownerId: owner, id: quizId, title: "Cell biology", createdAt: 1_794_000_000_000, questionCount: 1, language: "en", difficulty: "standard", purpose: "concepts", requestedCount: 1, topic: "Cells",
      sources: [{ id: "source-1", name: "Biology notes.pdf", kind: "pdf", unitKind: "page", units: [2] }],
      questions: [{ id: "question-1", type: "mcq", question: "What is ATP?", options: ["Energy carrier", "Cell wall"], answer: 0, explanation: "ATP carries energy.", concepts: ["ATP"], sourceId: "source-1", sourceName: "Biology notes.pdf", unit: 2 }],
    } });
    return route.fulfill(fail ? { status: 503, json: { message: "Unable to load quiz activity. Please retry." } } : { json: snapshot() });
  }
  const fixtures = {
    "/api/account/summary": { signedIn: false, email: null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 },
    "/api/account/preferences": { preferences: null },
    "/api/admin/dashboard": { generatedAt: "2026-11-04T12:00:00.000Z", summary: { knownUsers: 8, proUsers: 2, topUpUsers: 1, freeUsers: 5, remainingCredits: 10 }, subscribers: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } },
    "/api/admin/feedback": { items: [], nextOffset: null },
    "/api/admin/grading-failures": { items: [], nextOffset: null },
  };
  assert.ok(Object.hasOwn(fixtures, url.pathname), "Unexpected admin API " + url.pathname);
  return route.fulfill({ json: fixtures[url.pathname] });
});
try {
  assert.equal((await fetch(base + "/api/admin/quizzes")).status, 401);
  await context.addCookies([{ name: "admin_secret", value: "local-admin-quiz-browser-test-only", url: base }]);
  await page.goto(base + "/admin", { waitUntil: "networkidle" });
  const panel = page.getByRole("region", { name: "Quiz activity", exact: true });
  const value = label => panel.getByText(label, { exact: true }).locator("..").locator("dd");
  await panel.getByText("Saved quizzes", { exact: true }).waitFor();
  assert.equal(await value("Quiz users").innerText(), "124");
  assert.equal(await value("Saved quizzes").innerText(), "248");
  assert.equal(await value("Questions").innerText(), "1,240");
  assert.equal(await value("Practice sessions").innerText(), "360");
  assert.equal(await value("Completed sessions").innerText(), "270");
  assert.equal(await value("Review sessions").innerText(), "90");
  assert.equal(await value("Interrupted").innerText(), "1");
  assert.equal(await panel.getByText(/Partial snapshot/).count(), 0);
  await panel.getByText("Cell biology", { exact: true }).waitFor();
  await panel.getByRole("button", { name: "View quiz", exact: true }).click();
  await panel.getByRole("heading", { name: "What is ATP?", exact: false }).waitFor();
  assert.equal(await panel.getByText("A. Energy carrier — Correct", { exact: true }).count(), 1);
  assert.equal(await panel.getByText(/ATP carries energy/).count(), 1);
  await page.getByRole("heading", { name: "Subscriber roster", exact: true }).waitFor();
  pass("Quiz metrics and saved quiz details are admin-only and render alongside the existing subscriber dashboard");
  await panel.screenshot({ path: `${directory}/complete-1440.png` });
  coverage = "partial";
  await panel.getByRole("button", { name: "Refresh quizzes", exact: true }).click();
  await panel.getByRole("status").filter({ hasText: "Partial snapshot" }).waitFor();
  assert.equal(await value("Saved quizzes").innerText(), "≥ 248");
  assert.equal(await value("Completed generations").innerText(), "≥ 248");
  pass("Partial snapshots are explicit and use minimum counts");
  fail = true;
  await panel.getByRole("button", { name: "Refresh quizzes", exact: true }).click();
  await panel.getByRole("alert").waitFor();
  assert.equal(await panel.locator("dd").count(), 0, "failed refresh must not display stale or false-zero counts");
  fail = false; coverage = "complete";
  await panel.getByRole("button", { name: "Refresh quizzes", exact: true }).click();
  await value("Saved quizzes").waitFor();
  assert.equal(await value("Saved quizzes").innerText(), "248");
  assert.equal(await panel.getByRole("alert").count(), 0);
  pass("Unavailable metrics clear old counts and recover on refresh");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await panel.evaluate(node => node.scrollWidth > node.clientWidth), false, `quiz panel fits ${width}px`);
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `quiz panel remains in ${width}px viewport`);
    await panel.screenshot({ path: `${directory}/complete-${width}.png` });
  }
  pass("Quiz metrics remain readable on 320px and 390px mobile layouts");
  assert.ok(requests >= 4);
  assert.deepEqual(errors, []);
  writeFileSync(`${directory}/results.json`, JSON.stringify({ checks, errors, apiMode: "mocked admin data; live unauthorized endpoint checked" }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png`, fullPage: true });
  throw error;
} finally { await browser.close(); }
