import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let playwrightModule = process.env.PLAYWRIGHT_MODULE;
if (!playwrightModule && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) playwrightModule = readdirSync(links)
    .map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
const modulePath = playwrightModule && (/\.m?js$/.test(playwrightModule) ? playwrightModule : join(playwrightModule, "index.mjs"));
const playwright = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const { chromium } = playwright.default ?? playwright;
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3108";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Use a local server.");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([{ name: "admin_secret", value: process.env.TEST_ADMIN_SECRET ?? "local-admin-pagination-test", url: base }]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const records = Array.from({ length: 61 }, (_, n) => ({
  email: `subscriber-${String(n + 1).padStart(3, "0")}@test.invalid`,
  customerId: null, plan: "free", subscriptionStatus: "none",
  remainingCredits: 0, freeEvaluationsUsed: 0, freeEvaluationsRemaining: 3,
}));
const calls = [];
let failNext = false;
await context.route("**/api/**", async route => {
  const url = new URL(route.request().url());
  if (url.pathname === "/api/admin/dashboard") {
    const query = url.searchParams.get("q") ?? "";
    const size = Number(url.searchParams.get("pageSize"));
    assert.ok(size > 0 && size <= 100);
    calls.push(Object.fromEntries(url.searchParams));
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 503, json: { message: "Test dashboard unavailable." } });
      return;
    }
    // Delay one response to exercise cancellation when a newer search completes.
    if (query === "subscriber-00") await new Promise(resolve => setTimeout(resolve, 800));
    const filtered = records.filter(row => row.email.includes(query));
    const totalPages = Math.max(1, Math.ceil(filtered.length / size));
    const current = Math.min(Number(url.searchParams.get("page")), totalPages);
    await route.fulfill({ json: {
      generatedAt: new Date().toISOString(),
      summary: { knownUsers: 61, proUsers: 0, topUpUsers: 0, freeUsers: 61, remainingCredits: 0 },
      subscribers: filtered.slice((current - 1) * size, current * size),
      pagination: { page: current, pageSize: size, total: filtered.length, totalPages },
    } });
  } else if (url.pathname === "/api/admin/credits") {
    await route.fulfill({ json: { ok: true, email: "subscriber-061@test.invalid", balance: 10 } });
  } else if (url.pathname === "/api/admin/feedback") {
    await route.fulfill({ json: { items: [], nextOffset: null } });
  } else {
    await route.fulfill({ json: {} });
  }
});
async function waitText(text) { await page.getByText(text, { exact: true }).waitFor(); }
try {
  await page.goto(base + "/admin");
  const nav = page.getByRole("navigation", { name: "Subscriber pagination" });
  const next = nav.getByRole("button", { name: "Next", exact: true });
  const previous = nav.getByRole("button", { name: "Previous", exact: true });
  const search = page.getByRole("textbox", { name: "Search", exact: true });
  await waitText("Page 1 of 3");
  assert.equal(await page.locator("tbody tr").count(), 25);
  assert.equal(await previous.isDisabled(), true);
  await next.click();
  await waitText("Page 2 of 3");
  await waitText("subscriber-026@test.invalid");
  await next.click();
  await waitText("Page 3 of 3");
  assert.equal(await page.locator("tbody tr").count(), 11);
  assert.equal(await next.isDisabled(), true);
  await previous.click();
  await waitText("Page 2 of 3");

  await search.fill("subscriber-061");
  await waitText("Page 1 of 1");
  await waitText("subscriber-061@test.invalid");
  assert.equal(await page.locator("tbody tr").count(), 1);
  assert.equal(calls.at(-1).page, "1");
  await page.getByRole("button", { name: "Adjust credits", exact: true }).click();
  await page.getByRole("button", { name: "Apply credit adjustment" }).click();
  await waitText("Updated subscriber-061@test.invalid. New balance: 10.");
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  assert.equal(calls.at(-1).q, "subscriber-061");

  await search.fill("missing");
  await waitText("No known user records match this filter.");
  assert.equal(await next.isDisabled(), true);
  await search.fill("");
  await waitText("Page 1 of 3");
  await nav.getByRole("combobox").selectOption("50");
  await waitText("Page 1 of 2");
  assert.equal(await page.locator("tbody tr").count(), 50);
  await next.click();
  await waitText("Page 2 of 2");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  assert.equal(calls.at(-1).page, "2");
  assert.equal(calls.at(-1).pageSize, "50");

  const delayedRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get("q") === "subscriber-00");
  await search.fill("subscriber-00");
  await delayedRequest;
  await search.fill("subscriber-061");
  await waitText("Page 1 of 1");
  await waitText("subscriber-061@test.invalid");
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("tbody tr").count(), 1);
  await waitText("subscriber-061@test.invalid");

  failNext = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await waitText("Test dashboard unavailable.");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText("Test dashboard unavailable.", { exact: true }).waitFor({ state: "hidden" });
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.waitFor();
  await page.screenshot({ path: ".next/admin-pagination-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS admin pagination: boundaries, global search, page size, credits, refresh, stale requests and error retry");
} finally {
  await browser.close();
}
