import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import "./register-test-resolver.mjs";
const { translate } = await import("../src/i18n/translate.ts");

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3217";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local verification only");
const directory = process.env.TEST_ARTIFACT_DIR ?? "doc/verification/quiz";
mkdirSync(directory, { recursive: true });
const checks = [], errors = [];
const pass = name => { checks.push(name); console.log("PASS " + name); };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
let signedIn = false, source = null, quiz = null, job = null, polls = 0, attempts = [], saveFails = false, expired = false;
let preferredLanguage = "en";
let upload = null, uploadedBytes = 0;
let quizMutations = 0;
const id = randomUUID(), sourceId = randomUUID();
const trialAssignmentId = randomUUID();
function library() {
  if (job && job.status !== "completed") { polls++; job.status = polls > 2 ? "completed" : "generating"; }
  const active = attempts.find(a => !a.completedAt), latest = [...attempts].reverse().find(a => a.kind === "full" && a.completedAt);
  return { workspace: { projects: [], assignments: [] }, access: { pro: false, used: quiz ? 2 : 6, reserved: 0, remaining: quiz ? 2 : 4 }, jobs: job ? [job] : [], quizzes: quiz && job?.status === "completed" ? [{ ...quiz, questions: undefined, questionCount: 2, types: { mcq: 1, true_false: 1 }, state: active ? "active" : attempts.length ? "completed" : "unstarted", progress: active ? Object.keys(active.answers).length : 0, lastStudied: attempts.at(-1)?.updatedAt ?? 0, latestFull: latest ? { correct: quiz.questions.filter(q => latest.answers[q.id] === q.answer).length, total: 2 } : null }] : [] };
}
await context.route("**/*", async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  if (url.pathname.startsWith("/api/quizzes") && req.method() !== "GET") quizMutations++;
  let result = {}, status = 200;
  if (url.pathname === "/api/account/summary") result = { signedIn, email: signedIn ? "quiz-browser@test.invalid" : null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (url.pathname === "/api/account/preferences") result = { preferences: signedIn ? { siteLanguage: "en", resultLanguage: preferredLanguage } : null };
  else if (url.pathname === "/api/trial") result = req.method() === "POST" ? { result: { evaluation_id: trialAssignmentId } } : { used: true, pending: false, result: null };
  else if (url.pathname === "/api/workspace") result = { projects: [], assignments: [] };
  else if (url.pathname === "/api/entitlement") result = { plan: "free", status: "needs_restore" };
  else if (url.pathname === "/api/quizzes/sources") {
    if (req.method() === "GET") { if (expired) { status = 410; result = { code: "QUIZ_SOURCE_EXPIRED" }; } else result = { source }; }
    else if (req.method() === "PUT") {
      assert.equal(url.searchParams.get("id"), upload.id);
      uploadedBytes += req.postDataBuffer()?.length ?? 0;
      result = { ok: true };
    }
    else {
      const body = req.postDataJSON();
      if (body.action === "upload") {
        assert.equal(body.name, "Geometry notes.txt");
        upload = { id: randomUUID(), name: body.name, size: body.size };
        uploadedBytes = 0;
        result = { uploadId: upload.id, chunkBytes: 32 };
      } else {
        if (body.action === "extract") {
          assert.equal(body.id, upload.id);
          assert.equal(uploadedBytes, upload.size, "all source bytes upload before extraction");
        }
        source = { id: sourceId, name: body.action === "extract" ? upload.name : body.name, kind: "txt", unitKind: "paragraph", totalUnits: 1, segments: [{ unit: 1, text: "A triangle has three sides. A square has four equal sides." }], bytes: upload?.size ?? 0, receivedAt: Date.now(), expiresAt: Date.now() + 86400000, assignmentId: null, version: null, projectId: null };
        if (body.action === "assignment") {
          assert.equal(body.id, trialAssignmentId);
          Object.assign(source, { name: "Claimed guest assignment", kind: "assignment", assignmentId: trialAssignmentId, segments: [{ unit: 1, text: "A triangle has three sides." }] });
        }
        result = { source };
      }
    }
  } else if (url.pathname === "/api/quizzes") {
    if (req.method() === "GET") result = url.searchParams.has("id") ? { quiz, attempts: [...attempts].reverse(), linkedAssignmentIds: [] } : library();
    else if (req.method() === "PATCH") result = { ok: true };
    else {
      const body = req.postDataJSON();
      assert.equal(body.settings.count, 2); assert.equal(body.sources.length, 1);
      const { segments, ...ref } = source; void segments;
      quiz = { id, title: body.settings.title, projectId: null, createdAt: Date.now(), settings: body.settings, sources: [{ ...ref, units: [1] }], requestedCount: 2, questions: [
        { id: "1", type: "mcq", question: "How many sides does a triangle have?", options: ["Three", "Four", "Five", "Six"], answer: 0, explanation: "A triangle has three sides; a square has four.", concepts: ["Triangle"], sourceId, unit: 1 },
        { id: "2", type: "true_false", question: "A square has four equal sides.", options: ["O", "X"], answer: 0, explanation: "The source states that all four sides of a square are equal.", concepts: ["Square"], sourceId, unit: 1 },
      ] };
      job = { id: body.requestId, settings: body.settings, sources: quiz.sources, status: "queued", pro: false, reserved: 2, createdAt: Date.now(), leaseUntil: Date.now() + 300000, quizId: id, generatedCount: 2, error: null }; result = { job }; status = 202;
    }
  } else if (url.pathname === "/api/quizzes/attempts") {
    const body = req.postDataJSON();
    if (body.action === "start") {
      let current = attempts.find(a => !a.completedAt);
      if (!current) {
        const previous = attempts.find(a => a.id === body.fromAttempt);
        current = { id: body.id, quizId: id, kind: body.kind, questionIds: quiz.questions.filter(q => !previous || previous.questionIds.includes(q.id) && previous.answers[q.id] !== q.answer).map(q => q.id), answers: {}, position: 0, startedAt: Date.now(), updatedAt: Date.now(), completedAt: null, revision: 0 }; attempts.push(current);
      }
      result = { attempt: current };
    } else {
      const current = attempts.find(a => a.id === body.id);
      if (saveFails) { status = 503; result = { code: "QUIZ_UNAVAILABLE" }; }
      else { if (body.questionId) current.answers[body.questionId] = body.answer; if (body.position !== undefined) current.position = body.position; if (body.finish) current.completedAt = Date.now(); current.updatedAt = Date.now(); current.revision++; result = { attempt: current }; }
    }
  } else if (url.pathname === "/api/analytics") result = { ok: true };
  else { status = 503; result = {}; }
  await route.fulfill({ status, json: result });
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", dialog => dialog.accept());
const visit = path => page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
async function checkSample(locale = "en") {
  const samples = page.getByRole("region", { name: translate(locale, "Sample quiz"), exact: true });
  const multipleChoice = samples.getByRole("region", { name: translate(locale, "Sample · Multiple choice"), exact: true });
  const trueFalse = samples.getByRole("region", { name: translate(locale, "Sample · True / False"), exact: true });
  await multipleChoice.getByRole("button", { name: "B 4", exact: true }).focus();
  await page.keyboard.press("Enter");
  await multipleChoice.locator('[aria-live="polite"]').getByText(translate(locale, "Incorrect"), { exact: true }).waitFor();
  assert.equal(await multipleChoice.getByRole("button", { name: "B 4", exact: true }).getAttribute("aria-pressed"), "true");
  await multipleChoice.getByRole("button", { name: "A 3", exact: true }).click();
  await multipleChoice.locator('[aria-live="polite"]').getByText(translate(locale, "Correct"), { exact: true }).waitFor();
  assert.equal(await multipleChoice.getByRole("button", { name: "B 4", exact: true }).getAttribute("aria-pressed"), "false");
  const falseAnswer = trueFalse.getByRole("button", { name: "X " + translate(locale, "False"), exact: true });
  await falseAnswer.focus();
  await page.keyboard.press("Space");
  await trueFalse.locator('[aria-live="polite"]').getByText(translate(locale, "Correct"), { exact: true }).waitFor();
  assert.equal(await falseAnswer.getAttribute("aria-pressed"), "true");
  assert.equal(quizMutations, 0, "prepared samples must not generate quizzes, upload sources or save attempts");
}
async function checkStaticBrand(sidebar) {
  const brand = sidebar.getByText("RubriCheck", { exact: true });
  assert.equal(await brand.evaluate(node => Boolean(node.closest("a, button"))), false, "workspace title must not navigate or reset work");
  const before = page.url();
  await brand.click();
  assert.equal(page.url(), before);
}
try {
  const locales = ["en", "ko", "ms", "hi", "ur", "vi", "zh"];
  for (const locale of locales) {
    const path = (locale === "en" ? "" : "/" + locale) + "/ai-quiz-generator";
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('rel="canonical" href="https://rubricheck.com' + path + '"'));
    for (const lang of ["en", "ko-KR", "ms-MY", "hi-IN", "ur-PK", "vi-VN", "zh-CN", "x-default"]) assert.ok(html.includes(`hrefLang="${lang}"`) || html.includes(`hreflang="${lang}"`), lang);
    assert.ok(html.includes("/quizzes?view=create"));
    assert.ok(html.includes('<h1 id="quiz-title"'));
    assert.ok(!html.includes("quiz-browser@test.invalid"));
  }
  pass("Seven public locales have server HTML, canonical, reciprocal hreflang and creation links");
  const sitemap = await (await fetch(base + "/sitemap.xml")).text();
  assert.equal((sitemap.match(/<loc>[^<]*ai-quiz-generator<\/loc>/g) ?? []).length, 7);
  assert.ok(!sitemap.includes("/quizzes"));
  const guest = await fetch(base + "/quizzes?view=create");
  assert.match(guest.headers.get("x-robots-tag"), /noindex/);
  assert.ok((await guest.text()).includes("returnTo="));
  for (const path of ["/api/quizzes", "/api/quizzes/sources?id=" + sourceId]) assert.equal((await fetch(base + path)).status, 401);
  pass("Private pages are noindex, APIs reject guests, and sitemap excludes private quizzes");
  for (const locale of ["en", "ko", "ur"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit((locale === "en" ? "" : "/" + locale) + "/ai-quiz-generator");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), locale + " mobile overflow");
    assert.equal(await page.locator("html").getAttribute("dir"), locale === "ur" ? "rtl" : "ltr");
    await checkSample(locale);
    await page.screenshot({ path: `${directory}/${locale}-public-390.png`, fullPage: true });
  }
  pass("Interactive public samples support keyboard answers without API mutations in English, Korean and Urdu mobile layouts");
  await visit("/quizzes?view=create&trial=1");
  await checkSample();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "guest create screen overflow");
  await page.screenshot({ path: `${directory}/guest-create-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const guestSidebar = page.locator("aside[aria-label=Sidebar]");
  const workspaceHeader = page.locator('main header[aria-label="Workspace header"]');
  await workspaceHeader.waitFor();
  await workspaceHeader.getByRole("link", { name: "Pricing", exact: true }).waitFor();
  assert.match(await workspaceHeader.getByRole("link", { name: "Log in", exact: true }).getAttribute("href"), /returnTo=.*trial%3D1/);
  await checkStaticBrand(guestSidebar);
  assert.match(await guestSidebar.getByRole("link", { name: "Log in", exact: true }).getAttribute("href"), /returnTo=.*trial%3D1/);
  const languageButton = guestSidebar.getByRole("button", { name: "Language preferences", exact: true });
  assert.equal(await languageButton.locator("svg ellipse").count(), 1, "quiz language control uses the assignment globe icon");
  await languageButton.click();
  const languageDialog = page.getByRole("dialog", { name: "Account menu", exact: true });
  await languageDialog.getByLabel("Site language", { exact: true }).waitFor();
  await languageDialog.getByRole("button", { name: "Close account menu", exact: true }).click();
  pass("Guest quiz creation shares interactive samples, a static brand and the assignment login/language controls");
  const payload = Buffer.from(JSON.stringify({ email: "quiz-browser@test.invalid", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const token = payload + "." + createHmac("sha256", "local-quiz-browser-test-only").update(payload).digest("base64url");
  await context.addCookies([{ name: "rubricheck_credit_session", value: token, url: base }, { name: "rubricheck_analytics", value: "denied", url: base }]);
  signedIn = true;
  await visit("/workspace?start=login&returnTo=" + encodeURIComponent("/quizzes?view=create&trial=1"));
  await page.getByRole("heading", { name: "Claimed guest assignment", exact: true }).waitFor();
  assert.match(page.url(), /quizzes\?view=create&trial=1/);
  await workspaceHeader.getByRole("button", { name: "Open account menu", exact: true }).click();
  await page.getByRole("dialog", { name: "Account menu", exact: true }).getByText("Current plan", { exact: true }).waitFor();
  await page.getByRole("dialog", { name: "Account menu", exact: true }).getByRole("button", { name: "Close account menu", exact: true }).click();
  pass("Authentication return preserves the chosen guest assignment and claims it before creating a source");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const sidebar = page.locator("aside[aria-label=Sidebar]");
  await sidebar.getByRole("link", { name: "My quizzes", exact: true }).click();
  await page.getByRole("heading", { name: "My quizzes", exact: true }).waitFor();
  assert.equal(await sidebar.getByRole("link", { name: "New Quiz", exact: true }).getAttribute("aria-current"), "page");
  await sidebar.getByRole("link", { name: "New Assignment", exact: true }).click();
  await page.locator("#rubric-checker").waitFor();
  await checkStaticBrand(sidebar);
  assert.equal(await sidebar.getByRole("button", { name: "New Assignment", exact: true }).getAttribute("aria-current"), "page");
  await sidebar.getByRole("link", { name: "New Quiz", exact: true }).click();
  await page.getByRole("heading", { name: "Create a quiz", exact: true }).waitFor();
  await checkStaticBrand(sidebar);
  assert.equal(await sidebar.getByRole("link", { name: "New Quiz", exact: true }).getAttribute("aria-current"), "page");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).getByRole("link", { name: "My quizzes", exact: true }).click();
  await page.getByRole("heading", { name: "My quizzes", exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog", { name: "Sidebar", exact: true }).isVisible(), false);
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).getByRole("link", { name: "New Quiz", exact: true }).click();
  await page.getByRole("heading", { name: "Create a quiz", exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog", { name: "Sidebar", exact: true }).isVisible(), false);
  await page.getByRole("spinbutton", { name: "Question count", exact: true }).fill("1");
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).getByRole("link", { name: "New Quiz", exact: true }).click();
  assert.equal(await page.getByRole("spinbutton", { name: "Question count", exact: true }).inputValue(), "4", "New Quiz resets an existing creation form");
  pass("Assignment and quiz modes switch together with selected navigation and a working mobile drawer");
  await visit("/quizzes?view=create");
  await page.getByRole("heading", { name: "Create a quiz", exact: true }).waitFor();
  assert.equal(await page.getByRole("spinbutton", { name: "Question count", exact: true }).inputValue(), "4");
  assert.equal(await page.getByRole("button", { name: "Paste text", exact: true }).count(), 0);
  const advanced = page.locator("details").filter({ has: page.locator("summary", { hasText: "Advanced settings" }) });
  assert.equal(await advanced.evaluate(node => node.open), false);
  assert.equal(await page.getByLabel("Question language").isVisible(), false);
  await advanced.locator("summary").click();
  assert.equal(await page.getByLabel("Question language").locator("option").count(), 7);
  assert.equal(await page.getByLabel("Difficulty", { exact: true }).inputValue(), "standard");
  assert.equal(await page.getByLabel("Purpose", { exact: true }).inputValue(), "concepts");
  await advanced.locator("summary").click();
  const studyFile = { name: "Geometry notes.txt", mimeType: "text/plain", buffer: Buffer.from("A triangle has three sides. A square has four equal sides.") };
  const chooseFiles = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await (await chooseFiles).setFiles(studyFile);
  await page.getByRole("heading", { name: studyFile.name, exact: true }).waitFor();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: studyFile.name, exact: true }).count(), 0);
  assert.ok(await page.getByRole("button", { name: "Generate quiz", exact: true }).isDisabled());
  await page.getByLabel("Choose files", { exact: true }).setInputFiles(studyFile);
  await page.getByRole("button", { name: "Read source", exact: true }).click();
  await page.getByText("Preview and select scope", { exact: true }).waitFor();
  await page.getByText("Preview and select scope", { exact: true }).click();
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  assert.ok(await page.getByRole("button", { name: "Generate quiz", exact: true }).isDisabled(), "empty source scope cannot generate");
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.getByText("Preview and select scope", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "Question count", exact: true }).fill("99");
  await page.getByRole("spinbutton", { name: "Question count", exact: true }).blur();
  assert.equal(await page.getByRole("spinbutton", { name: "Question count", exact: true }).inputValue(), "4", "count respects remaining free questions");
  await page.getByRole("spinbutton", { name: "Question count", exact: true }).fill("2");
  await page.getByRole("spinbutton", { name: "Question count", exact: true }).blur();
  assert.equal(await page.getByLabel("Quiz title", { exact: true }).inputValue(), studyFile.name);
  const scopeHeading = page.getByRole("heading", { name: studyFile.name, exact: true });
  await scopeHeading.scrollIntoViewIfNeeded();
  assert.ok(await scopeHeading.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(bounds.left + 10, bounds.top + bounds.height / 2));
  }), "creation footer must not cover source scope");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "mobile creation overflow");
  await page.setViewportSize({ width: 320, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "narrow mobile creation overflow");
  await page.setViewportSize({ width: 390, height: 844 });
  pass("Quiz defaults, collapsed advanced settings, chunked file upload and source removal work");
  await page.screenshot({ path: `${directory}/create-390.png`, fullPage: true });
  await page.getByRole("button", { name: "Generate quiz", exact: true }).click();
  await page.getByRole("link", { name: "Practice now", exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole("link", { name: "Practice now", exact: true }).click();
  await page.getByRole("button", { name: "Start practice", exact: true }).click();
  await page.getByRole("radio", { name: "B. Four", exact: true }).check();
  saveFails = true;
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Not saved" }).waitFor();
  assert.equal(Object.keys(attempts[0].answers).length, 0);
  saveFails = false;
  await page.getByRole("alert").filter({ hasText: "Not saved" }).getByRole("button", { name: "Try again" }).click();
  await page.getByText("Incorrect", { exact: true }).waitFor();
  assert.ok(await page.getByRole("radio", { name: "B. Four", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Next question", exact: true }).last().click();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("A square has four equal sides.", { exact: true }).waitFor();
  pass("Creation, seven language choices, save-failure retry, answer locking and refresh resume work");
  await page.getByText("1 unanswered questions", { exact: true }).click();
  await page.getByRole("button", { name: "View study results", exact: true }).click();
  await page.getByRole("heading", { name: "Review complete" }).waitFor();
  await page.getByRole("button", { name: "Review mistakes and unanswered questions" }).click();
  assert.equal(attempts.at(-1).kind, "review");
  await page.getByRole("radio", { name: "A. Three", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  expired = true;
  await page.getByRole("button", { name: "View source", exact: true }).click();
  await page.getByRole("dialog").getByText("Source expired. Attach it again to create new questions.").waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Next question", exact: true }).last().click();
  await page.getByRole("radio", { name: "O · True", exact: true }).check();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByRole("button", { name: "View study results", exact: true }).first().click();
  await page.getByRole("heading", { name: "Review complete" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Previous attempts", exact: true }).locator("..").getByRole("button").count(), 2);
  await page.screenshot({ path: `${directory}/review-390.png`, fullPage: true });
  await visit("/quizzes");
  await page.getByText(/Latest full attempt: 0\/2/).waitFor();
  pass("Wrong and unanswered review survives source expiry and preserves the full-attempt score");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${directory}/library-1440.png`, fullPage: true });
  for (const locale of locales) {
    preferredLanguage = locale;
    const prefix = locale === "en" ? "" : "/" + locale;
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(prefix + "/quizzes?view=create");
    await page.locator("summary").filter({ hasText: translate(locale, "Advanced settings") }).click();
    const language = page.getByLabel(translate(locale, "Question language"), { exact: true });
    await language.waitFor();
    assert.equal(await language.inputValue(), locale, "saved result language default");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), locale + " private creation overflow");
    await visit(prefix + "/quizzes?id=" + id);
    await page.getByRole("heading", { name: translate(locale, "Review complete"), exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), locale + " private review overflow");
    if (["ko", "ur"].includes(locale)) await page.screenshot({ path: `${directory}/${locale}-review-390.png`, fullPage: true });
  }
  pass("All seven authenticated creation and review screens fit mobile; saved question language is restored");
  preferredLanguage = "en"; expired = false;
  quiz.title = "Renamed geometry"; quiz.projectId = null;
  quiz.settings.projectId = randomUUID(); // Original project has since been deleted.
  await visit("/quizzes?view=create&from=" + id);
  await page.getByRole("heading", { name: "Geometry notes.txt", exact: true }).waitFor();
  await page.locator("summary").filter({ hasText: "Advanced settings" }).click();
  assert.equal(await page.getByLabel("Quiz title", { exact: true }).inputValue(), "Renamed geometry");
  assert.equal(await page.getByLabel("Project", { exact: true }).inputValue(), "");
  pass("Reusing a renamed quiz follows current project membership after project deletion");
  assert.deepEqual(errors, []);
  writeFileSync(`${directory}/results.json`, JSON.stringify({ checks, errors, apiMode: "mocked browser API; live Redis and model covered by separate integration scripts" }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${directory}/failure.png`, fullPage: true });
  console.error({ url: page.url(), errors, screen: (await page.locator("main").innerText()).slice(0, 6000) });
  throw error;
} finally { await browser.close(); }
