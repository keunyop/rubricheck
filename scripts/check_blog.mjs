import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

// Built app, local server, anonymous API fixtures, no hosted requests.
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  assert.ok(!existsSync(name), "Run the blog check in an isolated checkout without automatically loaded environment files.");
}
let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const socket = createServer().listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const article = "/blog/assignment-requirements-checklist";
const title = "Assignment Requirements Checklist: 5 Checks Before Submission";
const analysisArticle = "/blog/descriptive-vs-critical-analysis";
const analysisTitle = "Essay Too Descriptive? How to Add Critical Analysis";
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(OPENAI|SUPABASE|STRIPE|UPSTASH|NEXT_PUBLIC|GROWTH|RESEND|VERCEL|DATABASE)/.test(key)));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", chunk => { output += chunk; });
server.stderr.on("data", chunk => { output += chunk; });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw Error("Local server exited: " + output);
    try { if ((await fetch(base + "/blog")).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, "Local blog server started");
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "win32" ? "msedge" : undefined) });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const errors = [];
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const data = {
      "/api/account/summary": { signedIn: false, email: null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 },
      "/api/account/preferences": { preferences: null },
      "/api/entitlement": { plan: "free", status: "needs_restore" },
      "/api/comparison-images": { images: [] },
      "/api/trial": { used: false, pending: false, result: null },
      "/api/workspace": { projects: [], assignments: [] },
    }[url.pathname];
    assert.ok(data, "No unexpected service action: " + url.pathname);
    return route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/blog", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: title, exact: true }).click();
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await page.waitForFunction(expected => document.querySelector('link[rel="canonical"]')?.getAttribute("href") === expected, "https://rubricheck.com" + article);
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://rubricheck.com" + article);
    assert.equal(await page.locator('link[rel="alternate"][hreflang]').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
    for (const link of await page.locator('footer a[hreflang]:not([hreflang="en"])').all()) assert.ok(!(await link.getAttribute("href")).includes("/blog"), "Language links lead to existing content");
    // Capture a direct search landing as well as checking client navigation above.
    await page.goto(base + article, { waitUntil: "networkidle" });
    mkdirSync("doc/verification/blog", { recursive: true });
    await page.screenshot({ path: `doc/verification/blog/article-${width}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Check my assignment →", exact: true }).click();
  await page.locator("#rubric-checker").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).pathname, "/workspace");
  for (const path of ["/assignment-rubric-checker", "/essay-rubric-checker", "/how-to-use-a-rubric-to-check-an-assignment", "/rubric-feedback-tool"]) {
    await page.goto(base + path);
    const link = page.getByRole("link", { name: "our assignment requirements checklist", exact: true });
    assert.equal(await link.getAttribute("href"), article);
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  await staticPage.goto(base + "/blog");
  await staticPage.getByRole("link", { name: title, exact: true }).click();
  assert.equal(await staticPage.locator("h1").innerText(), title);
  assert.ok((await staticPage.locator("article").innerText()).includes("three course readings"));
  await staticPage.getByRole("link", { name: "make a descriptive essay more analytical", exact: true }).click();
  assert.equal(await staticPage.locator("h1").innerText(), analysisTitle);
  assert.ok((await staticPage.locator("article").innerText()).includes("Invented practice scenario"));
  const { default: AxeBuilder } = await import(pathToFileURL(process.env.AXE_MODULE || "node_modules/@axe-core/playwright/dist/index.mjs").href);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/blog");
    await page.getByRole("link", { name: analysisTitle, exact: true }).click();
    await page.getByRole("heading", { name: analysisTitle, exact: true }).waitFor();
    await page.waitForFunction(expected => document.querySelector('link[rel="canonical"]')?.getAttribute("href") === expected, "https://rubricheck.com" + analysisArticle);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "New article fits viewport");
    assert.equal(await page.locator('link[rel="alternate"][hreflang]').count(), 0);
    const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
    assert.ok(structured.some(value => { const data = JSON.parse(value); return data["@type"] === "BlogPosting" && data.headline === analysisTitle && data.datePublished === "2026-11-02"; }));
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(audit.violations, [], "New article accessibility");
    await page.screenshot({ path: `doc/verification/blog/critical-analysis-${width}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Review my revised draft →", exact: true }).click();
  await page.locator("#rubric-checker").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).pathname, "/workspace");
  for (const path of ["/essay-rubric-checker", "/rubric-feedback-tool"]) {
    await page.goto(base + path);
    assert.equal(await page.getByRole("link", { name: "this critical analysis revision exercise", exact: true }).getAttribute("href"), analysisArticle);
  }
  assert.equal((await fetch(base + "/blog/not-a-post")).status, 404);
  assert.equal((await fetch(base + "/ko/blog")).status, 404);
  assert.deepEqual(errors, []);
  console.log("Blog browser checks passed: desktop/mobile, metadata, no-JS reading, existing-guide links, workspace entry, locale links, 404s, no runtime errors. Evaluation/Auth/billing use is not tested.");
} finally {
  await browser?.close();
  if (server.exitCode === null && server.pid) { const stopped = once(server, "exit"); server.kill(); await stopped; }
}
