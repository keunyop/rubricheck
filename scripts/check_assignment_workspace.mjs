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
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let email = "student@example.com", failList = false, failOpen = false;
let projects = [{ id: randomUUID(), name: "History essay", createdAt: 1000 }];
let assignments = [
  { id: randomUUID(), title: "Industrial revolution — first draft", projectId: projects[0].id, createdAt: 1000, mode: "standard", overallRange: [62, 70] },
  { id: randomUUID(), title: "Industrial revolution — revised", projectId: projects[0].id, createdAt: 2000, mode: "standard", overallRange: [76, 84] },
  { id: randomUUID(), title: "Biology lab report", projectId: null, createdAt: 3000, mode: "standard", overallRange: [80, 88] },
];
const essayId = projects[0].id;
let evaluations = 0, gradedProject = null;
const feedback = item => ({
  evaluation_id: item.id, title: item.title, access_tier: "free", overall_range: item.overallRange,
  summary: "Feedback for " + item.title, top_improvements: ["Support the argument with evidence."],
  criteria: [{ name: "Evidence", max_score: 100, estimated_range: item.overallRange, feedback: "Explain how the source supports your claim.", detailed_breakdown_locked: true }],
});
await context.route("**/api/**", async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  let json = {}, status = 200;
  if (path === "/api/account/summary") json = { signedIn: Boolean(email), email, plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
  else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
  else if (path === "/api/comparison-images") json = { images: [] };
  else if (path === "/api/account/logout") { email = ""; json = { ok: true }; }
  else if (path === "/api/workspace" && request.method() === "GET") {
    if (failList) { status = 503; json = { message: "Could not load your assignments. Try again." }; }
    else json = email === "student@example.com" ? { projects, assignments: [...assignments].sort((a, b) => b.createdAt - a.createdAt) } : { projects: [], assignments: [] };
  } else if (path === "/api/workspace") {
    const body = request.postDataJSON();
    if (body.action === "createProject") { const project = { id: randomUUID(), name: body.name, createdAt: Date.now() }; projects.push(project); json = { ok: true, project }; }
    else if (body.action === "renameProject") projects.find(item => item.id === body.id).name = body.name;
    else if (body.action === "deleteProject") { projects = projects.filter(item => item.id !== body.id); assignments.forEach(item => { if (item.projectId === body.id) item.projectId = null; }); }
    else if (body.action === "moveAssignment") assignments.find(item => item.id === body.id).projectId = body.projectId;
    else if (body.action !== "importEvaluation") throw Error("Unexpected mutation " + body.action);
  } else if (path.startsWith("/api/workspace/assignments/") || path.startsWith("/api/evaluations/")) {
    const item = assignments.find(item => item.id === path.split("/").pop());
    if (failOpen || !item || email !== "student@example.com") { status = 404; json = { message: "This assignment is no longer available." }; }
    else json = { result: feedback(item), mode: item.mode };
  } else if (path === "/api/evaluate") {
    evaluations++; gradedProject = request.headers()["x-project-id"] ?? null;
    const item = { id: randomUUID(), title: "Industrial revolution — final draft", projectId: gradedProject, createdAt: Date.now(), mode: "standard", overallRange: [85, 92] };
    assignments.push(item); json = feedback(item);
  } else throw Error("Unexpected API " + path);
  await route.fulfill({ status, json });
});
const sidebar = page.locator("aside[aria-label=Sidebar]");
const pass = name => console.log("PASS " + name);
try {
  await page.goto(base);
  await sidebar.getByRole("button", { name: "Biology lab report", exact: true }).waitFor();
  const labels = await sidebar.locator("nav").innerText();
  assert.ok(labels.indexOf("Projects") < labels.indexOf("Recents"));
  await sidebar.getByRole("button", { name: "Industrial revolution — revised", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  assert.equal(await page.locator("#rubric-checker").isVisible(), false);
  assert.ok(page.url().includes("evaluation_id="));
  await page.screenshot({ path: ".next/workspace-result.png", fullPage: false });
  pass("recent assignment opens its result in the main screen");

  await page.reload();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  assert.equal(await page.locator("#rubric-checker").isVisible(), false);
  pass("result URL restores after reload");

  await sidebar.getByRole("button", { name: "History essay", exact: true }).click();
  const project = page.getByRole("region", { name: "Project", exact: true });
  await project.getByRole("heading", { name: "History essay", exact: true }).waitFor();
  assert.equal(await project.getByRole("button", { name: /V2 Industrial/ }).count(), 1);
  assert.equal(await project.getByRole("button", { name: /V1 Industrial/ }).count(), 1);
  await page.screenshot({ path: ".next/workspace-project.png", fullPage: false });
  pass("project groups drafts in chronological version order");

  await sidebar.getByRole("button", { name: "Search assignments", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search assignments", exact: true });
  await search.getByRole("textbox").fill("biology");
  await search.getByRole("button", { name: /Biology lab report/ }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  await page.getByRole("combobox", { name: "Move assignment to project" }).selectOption(essayId);
  await sidebar.getByRole("button", { name: "History essay", exact: true }).click();
  await project.getByRole("button", { name: /V3 Biology/ }).waitFor();
  pass("search and moving an existing assignment into a project");

  await sidebar.getByRole("button", { name: "New project", exact: true }).first().click();
  const create = page.getByRole("dialog", { name: "New project", exact: true });
  await create.getByLabel("Project name").fill("Research paper");
  await create.getByRole("button", { name: "Create project", exact: true }).click();
  await project.getByRole("heading", { name: "Research paper", exact: true }).waitFor();
  await project.getByText("No versions yet", { exact: true }).waitFor();
  await project.getByRole("button", { name: "Rename", exact: true }).click();
  await project.getByRole("textbox", { name: "Project name" }).fill("Final research paper");
  await project.getByRole("button", { name: "Save", exact: true }).click();
  await project.getByRole("heading", { name: "Final research paper", exact: true }).waitFor();
  await project.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog", { name: "Delete project?", exact: true }).getByRole("button", { name: "Delete project", exact: true }).click();
  await page.locator("#rubric-checker").waitFor({ state: "visible" });
  assert.equal(projects.some(item => item.name === "Final research paper"), false);
  pass("create, rename, empty state and delete project");

  await sidebar.getByRole("button", { name: "History essay", exact: true }).click();
  await project.getByRole("button", { name: "New version", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await page.getByRole("button", { name: "Text", exact: true }).nth(1).click();
  await page.getByPlaceholder("Paste rubric text here").fill("Evidence 100 points.");
  await page.getByPlaceholder("Paste assignment text here").fill("The final revised assignment with stronger evidence.");
  await page.reload();
  await page.getByPlaceholder("Paste assignment text here").waitFor();
  assert.equal(await page.getByPlaceholder("Paste assignment text here").inputValue(), "The final revised assignment with stronger evidence.");
  await page.getByRole("button", { name: "Grade my assignment", exact: true }).click();
  await sidebar.getByRole("button", { name: "Industrial revolution — final draft", exact: true }).waitFor();
  assert.equal(evaluations, 1);
  assert.equal(gradedProject, essayId);
  await sidebar.getByRole("button", { name: "History essay", exact: true }).click();
  await project.getByRole("button", { name: /V4 Industrial/ }).waitFor();
  pass("new grading is saved as the next project version");

  await sidebar.getByRole("button", { name: "Industrial revolution — final draft", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  await sidebar.getByRole("button", { name: "New Assignment", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.has("evaluation_id"), false);
  await page.getByRole("button", { name: "Text", exact: true }).nth(1).click();
  assert.equal(await page.getByPlaceholder("Paste assignment text here").inputValue(), "");
  assert.equal(await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).count(), 0);
  pass("New Assignment clears inputs and the selected result");

  await sidebar.getByRole("button", { name: "Close sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Open sidebar", exact: true }).filter({ visible: true }).click();
  await page.keyboard.press("Control+k");
  await search.waitFor({ state: "visible" });
  await search.getByRole("textbox").fill("not-a-match");
  await search.getByText("No results found.", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  pass("sidebar toggle and keyboard search");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open sidebar", exact: true }).filter({ visible: true }).click();
  const mobile = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await mobile.getByRole("button", { name: "History essay", exact: true }).click();
  await project.getByRole("heading", { name: "History essay", exact: true }).waitFor();
  assert.equal(await mobile.isVisible(), false);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: ".next/workspace-mobile.png", fullPage: false });
  await page.getByRole("button", { name: "Open sidebar", exact: true }).filter({ visible: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(await mobile.isVisible(), false);
  pass("mobile drawer, Escape and viewport fit");

  await page.setViewportSize({ width: 1440, height: 1000 });
  failOpen = true;
  await sidebar.getByRole("button", { name: "Biology lab report", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "This assignment is no longer available." }).waitFor();
  failOpen = false;
  failList = true;
  await page.reload();
  await sidebar.getByRole("button", { name: "Try again", exact: true }).waitFor();
  failList = false;
  await sidebar.getByRole("button", { name: "Try again", exact: true }).click();
  await sidebar.getByRole("button", { name: "Biology lab report", exact: true }).waitFor();
  pass("failed reads show recoverable errors");

  await sidebar.getByRole("button", { name: "Biology lab report", exact: true }).click();
  await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).waitFor();
  await page.getByRole("button", { name: email, exact: true }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await sidebar.getByText("Log in to see your assignments.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).count(), 0);
  email = "another@example.com";
  await page.reload();
  await sidebar.getByText("Your graded assignments appear here.", { exact: true }).waitFor();
  assert.equal(await sidebar.getByRole("button", { name: "Biology lab report", exact: true }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Evaluation Summary", exact: true }).count(), 0);
  pass("logout and another account never show previous account history");
  assert.deepEqual(errors, []);
  console.log("All workspace browser checks passed.");
} catch (error) {
  await mkdir(".next", { recursive: true });
  await page.screenshot({ path: ".next/workspace-failure.png", fullPage: true });
  console.error((await page.locator("body").innerText()).slice(0, 5500));
  throw error;
} finally { await browser.close(); }
