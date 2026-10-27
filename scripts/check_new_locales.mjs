import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(existsSync);
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const locales = process.env.TEST_LOCALES?.split(",") ?? ["hi", "ur", "vi", "zh"];
const widths = process.env.TEST_WIDTHS?.split(",").map(Number) ?? [375, 1440];
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      let json = {};
      if (path === "/api/account/summary") json = { signedIn: false, email: "", plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
      else if (path === "/api/trial") json = { used: false, pending: false, result: null };
      else if (path === "/api/workspace") json = { projects: [], assignments: [] };
      else if (path === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
      else if (path === "/api/comparison-images") json = { images: [] };
      await route.fulfill({ json });
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(180000);
    page.on("pageerror", error => errors.push(error.message));
    for (const locale of locales) {
      for (const path of ["", "/pricing", "/workspace"]) {
        const response = await page.goto(`${base}/${locale}${path}`, { waitUntil: "networkidle" });
        assert.equal(response.status(), 200, `${locale}${path} loads`);
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("html").getAttribute("dir"), locale === "ur" ? "rtl" : "ltr", `${locale}${path} direction`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${locale}${path} at ${width}px has no page overflow`);
        assert.ok((await page.locator("h1").first().innerText()).trim().length > 0, `${locale}${path} heading renders`);
        await page.screenshot({ path: `.next/locale-${locale}-${path.slice(1) || "home"}-${width}.png`, fullPage: true, animations: "disabled" });
      }
      // Both selectors must expose all four new languages on the account settings screen.
      if (width < 768) {
        await page.locator('button[class*="mobileOpen"]').click();
        await page.locator('dialog[open] button[aria-haspopup="dialog"]').click();
      } else {
        await page.locator('aside button[aria-haspopup="dialog"]').click();
      }
      const selects = page.locator('dialog[open] select[id$="-site"], dialog[open] select[id$="-result"]');
      assert.equal(await selects.count(), 2, `${locale} settings show two language selectors`);
      if (locale === "ur") {
        const label = page.locator('dialog[open] label[for$="-site"]');
        assert.equal(await label.evaluate(element => getComputedStyle(element).textAlign), "start", "Urdu labels follow the right-to-left layout");
      }
      for (const select of [selects.first(), selects.last()]) {
        for (const option of locales) assert.equal(await select.locator(`option[value="${option}"]`).count(), 1);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${locale} account dialog has no horizontal overflow`);
      await page.screenshot({ path: `.next/locale-${locale}-settings-${width}.png`, animations: "disabled" });
      console.log(`PASS ${locale}, ${width}px: pages render with direction and no horizontal overflow`);
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
