// Verify consent visibility and real gtag.js payloads without writing growth data.
// Collection is intercepted; GA4_VERIFY_DELIVERY=true delivers one page view.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = new URL(process.env.TEST_BASE_URL ?? "http://127.0.0.1:3120").origin;
const measurementId = "G-S7M12R54DP";
const googleHost = hostname => /(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com|doubleclick\.net)$/.test(hostname);
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [], payloads = [], delivered = [];
const output = ".growth-local/ga4-regression.json";
mkdirSync(".growth-local", { recursive: true });

async function context({ consent, signal, width = 390 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  if (consent) await context.addCookies([{ name: "rubricheck_analytics", value: consent, url: base }]);
  if (signal) await context.addInitScript(signal => Object.defineProperty(navigator, signal, { value: signal === "doNotTrack" ? "1" : true }), signal);
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base && url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/analytics") return route.fulfill({ status: 204 });
      return route.fulfill({ json: { signedIn: false, plan: "free", remainingEvaluations: 3, creditsBalance: 0, used: false, images: [], projects: [], assignments: [], preferences: null } });
    }
    if (url.origin === base && url.pathname.startsWith("/_vercel/")) return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
    if (googleHost(url.hostname) && url.pathname.includes("collect")) {
      for (const line of (request.postData() || "").split("\n")) {
        const params = new URLSearchParams(url.search);
        for (const [key, value] of new URLSearchParams(line)) params.set(key, value);
        const payload = { event: params.get("en"), measurementId: params.get("tid"), location: params.get("dl"), referrer: params.get("dr"), title: params.get("dt") };
        payloads.push(payload);
        const location = new URL(payload.location);
        const bare = location.pathname.replace(/^\/(ko|ms|hi|ur|vi|zh)(?=\/|$)/, "") || "/";
        if (payload.measurementId !== measurementId || location.origin !== base || location.search || location.hash || !["/pricing", "/product"].includes(bare) || payload.referrer || payload.title !== "RubriCheck" || params.has("uid") || decodeURIComponent(request.url() + (request.postData() || "")).includes("ga4-private-sentinel")) {
          errors.push({ reason: "Unexpected or sensitive analytics payload", payload });
          return route.abort();
        }
      }
      if (process.env.GA4_VERIFY_DELIVERY === "true" && !delivered.length && payloads.at(-1).event === "page_view") {
        const response = await route.fetch({ timeout: 15000 });
        delivered.push({ event: "page_view", status: response.status() });
        return route.fulfill({ response });
      }
      return route.fulfill({ status: 204 });
    }
    return route.continue();
  });
  return context;
}

async function inViewport(locator, page) {
  const box = await locator.boundingBox(), viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, "Consent choice is visible without scrolling");
}

try {
  for (const width of [390, 1440]) {
    const ctx = await context({ width }), page = await ctx.newPage();
    await page.goto(base + "/pricing", { waitUntil: "networkidle" });
    const allow = page.getByRole("button", { name: "Allow analytics", exact: true });
    await allow.waitFor();
    await inViewport(allow, page);
    await inViewport(page.getByRole("button", { name: "No thanks", exact: true }), page);
    await page.screenshot({ path: `.growth-local/ga4-consent-${width}.png` });
    assert.equal(await page.locator("#rubricheck-ga4").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "No thanks", exact: true }).click()]);
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("#rubricheck-ga4").count(), 0);
    assert.equal((await ctx.cookies()).find(cookie => cookie.name === "rubricheck_analytics")?.value, "denied");
    checks.push(`Visible, equal consent choices and working refusal at ${width}px`);
    await ctx.close();
  }
  for (const signal of ["globalPrivacyControl", "doNotTrack"]) {
    const ctx = await context({ consent: "granted", signal }), page = await ctx.newPage();
    await page.goto(base + "/pricing", { waitUntil: "networkidle" });
    assert.equal(await page.locator("#rubricheck-ga4").count(), 0);
    await ctx.close();
    checks.push(`${signal} prevents collection`);
  }
  const ctx = await context(), page = await ctx.newPage();
  page.on("pageerror", error => errors.push({ reason: error.message }));
  await page.goto(base + "/pricing?email=ga4-private-sentinel&checkout_session_id=ga4-private-sentinel#private", { waitUntil: "networkidle" });
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Allow analytics", exact: true }).click()]);
  await page.waitForFunction(() => document.getElementById("rubricheck-ga4"));
  await assertPageView("/pricing", 0);
  checks.push("Opt-in enables one sanitized page view using real gtag.js");

  // Client navigation must send one further manual page view.
  let before = payloads.length;
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Product", exact: true }).click();
  await page.waitForURL(base + "/product");
  await assertPageView("/product", before);
  checks.push("Client navigation sends one page view");
  for (const locale of ["ko", "ms", "hi", "ur", "vi", "zh"]) {
    before = payloads.length;
    await page.goto(`${base}/${locale}/pricing?email=ga4-private-sentinel#private`, { waitUntil: "networkidle" });
    await assertPageView(`/${locale}/pricing`, before);
    checks.push(`${locale} public page is measured`);
  }
  await page.goto(base + "/pricing", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Turn off analytics", exact: true }).waitFor();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Turn off analytics", exact: true }).click()]);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.locator("#rubricheck-ga4").count(), 0);
  await ctx.close();
  checks.push("Withdrawal unloads Google analytics");

  const privateContext = await context({ consent: "granted" }), privatePage = await privateContext.newPage();
  await privatePage.goto(base + "/billing/manage?email=ga4-private-sentinel", { waitUntil: "networkidle" });
  assert.equal(await privatePage.locator("#rubricheck-ga4").count(), 0);
  await privateContext.close();
  checks.push("Private billing route is excluded");
  assert.deepEqual(errors, []);
  if (process.env.GA4_VERIFY_DELIVERY === "true") assert.ok(delivered.length === 1 && [200, 204].includes(delivered[0].status));
  console.log(JSON.stringify({ passed: true, checks, delivered }));

  async function assertPageView(path, after) {
    await assert.doesNotReject(async () => {
      for (let attempt = 0; attempt < 60; attempt++) {
        if (payloads.slice(after).some(payload => payload.event === "page_view" && payload.location === base + path)) break;
        await page.waitForTimeout(250);
      }
      const matches = payloads.slice(after).filter(payload => payload.event === "page_view" && payload.location === base + path);
      assert.equal(matches.length, 1, `Exactly one page view for ${path}`);
    });
  }
} finally {
  await browser.close();
  writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), base, checks, payloads, delivered, errors }, null, 2));
}
