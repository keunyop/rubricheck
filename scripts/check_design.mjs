import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3200";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local verification only");
const baseline = process.argv.includes("--baseline");
const menuOnly = process.argv.includes("--menu-only");
const output = ".growth-local/design/" + (baseline ? "before" : "after");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
const errors = [];
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  const fixtures = {
    "/api/account/summary": { signedIn: false, plan: "free", remainingEvaluations: 3, creditsBalance: 0 },
    "/api/account/preferences": { preferences: null },
    "/api/entitlement": { plan: "free", status: "needs_restore" },
    "/api/trial": { used: false, pending: false, result: null },
    "/api/workspace": { projects: [], assignments: [] },
    "/api/comparison-images": { images: [] },
  };
  if (!Object.hasOwn(fixtures, url.pathname)) errors.push("Unexpected API: " + url.pathname);
  return route.fulfill({ json: fixtures[url.pathname] ?? {} });
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);
page.on("pageerror", error => errors.push(error.message));
try {
  for (const width of menuOnly ? [] : baseline ? [390, 1440] : [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of [["landing", "/"], ["workspace", "/workspace"], ["quiz", "/ai-quiz-generator"], ["pricing", "/pricing"]]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--rc-accent").trim()), "", "Shared design tokens are loaded");
      if (path === "/workspace") await page.waitForFunction(() => document.querySelector("#rubric-checker fieldset")?.disabled === false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} fits ${width}px`);
      if ([390, 1440].includes(width)) {
        await page.screenshot({ path: join(output, `${name}-${width}.png`), fullPage: true });
        await page.screenshot({ path: join(output, `${name}-${width}-viewport.png`) });
      }
      console.log(`PASS ${path} at ${width}px`);
    }
  }
  if (!baseline) {
    for (const locale of ["", "/ko", "/ms", "/ur"]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + (locale || "/"), { waitUntil: "networkidle" });
      const toggle = page.locator("#site-navigation-toggle");
      const nav = page.locator("#site-navigation");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await nav.isVisible(), false);
      await toggle.focus();
      await page.keyboard.press("Enter");
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Tab");
      assert.equal(await nav.evaluate(element => element.contains(document.activeElement)), true);
      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      assert.equal(await toggle.evaluate(element => element === document.activeElement), true);
      await toggle.click();
      await nav.locator(`a[href="${locale}/pricing"]`).click();
      await page.waitForURL("**/pricing");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      await page.setViewportSize({ width: 1440, height: 1000 });
      const desktopNav = page.locator("header nav:visible");
      assert.equal(await desktopNav.count(), 1);
      await page.locator("header a").first().focus();
      await page.keyboard.press("Tab");
      assert.equal(await desktopNav.evaluate(element => element.contains(document.activeElement)), true, "Desktop focus follows visual order");
      console.log(`PASS ${locale || "en"} menu: keyboard, Escape, navigation, desktop resize`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
