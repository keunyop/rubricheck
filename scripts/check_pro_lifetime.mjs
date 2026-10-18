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
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true });
const errors = [];
const context = await browser.newContext();
let signedIn = false;
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  if (url.pathname === "/api/account/summary") return route.fulfill({ json: { signedIn, email: signedIn ? "student@example.com" : null, plan: signedIn ? "pro" : "free", creditsBalance: 0 } });
  if (url.pathname === "/api/account/preferences") return route.fulfill({ json: { preferences: null } });
  if (url.pathname === "/api/billing/status") return route.fulfill({ json: { status: "lifetime", hasLifetimeAccess: true, currentPeriodEnd: null, hasProSubscription: false } });
  if (url.pathname === "/api/credits/refund") return route.fulfill({ json: { supported: false, refundableCredits: 0, refundableAmount: 0 } });
  throw Error("Unexpected API call: " + url.pathname);
});
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);
page.on("pageerror", error => errors.push(error.message));
const locales = [
  { path: "", lifetime: "Pro Lifetime", monthly: "Monthly", annual: "Annual", comingSoon: "Coming soon" },
  { path: "/ko", lifetime: "Pro 평생 이용권", monthly: "월간", annual: "연간", comingSoon: "준비 중" },
  { path: "/ms", lifetime: "Pro Seumur Hidup", monthly: "Bulanan", annual: "Tahunan", comingSoon: "Akan datang" },
];
mkdirSync("doc/verification/lifetime", { recursive: true });
try {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const locale of locales) {
      await page.goto(base + locale.path + "/pricing");
      const lifetime = page.getByRole("button", { name: locale.lifetime, exact: true });
      await lifetime.waitFor();
      assert.equal(await lifetime.isDisabled(), true);
      assert.equal(await lifetime.getAttribute("aria-pressed"), "false");
      const preview = page.locator("#lifetime-plan-preview");
      assert.match(await preview.innerText(), /\$99\.99/);
      assert.ok((await preview.innerText()).includes(locale.comingSoon));
      const monthly = page.getByRole("button", { name: locale.monthly, exact: true });
      const annual = page.getByRole("button", { name: locale.annual, exact: true });
      await annual.click();
      assert.match(await page.locator('[aria-live="polite"]').innerText(), /\$59\.99/);
      await monthly.click();
      assert.match(await page.locator('[aria-live="polite"]').innerText(), /\$7\.99/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (locale.path === "/ko") await page.screenshot({ path: `doc/verification/lifetime/pricing-${width}.png`, fullPage: true });
    }
  }
  signedIn = true;
  await page.goto(base + "/billing/manage");
  await page.getByText("Lifetime access is active. No renewal or recurring charges.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Manage or cancel subscription", exact: true }).count(), 0);
  assert.equal(await page.getByText(/9999/).count(), 0);
  assert.deepEqual(errors, []);
  console.log("Verified lifetime pricing in 3 languages at 2 widths, recurring prices, and lifetime billing state; no browser errors.");
} finally {
  await browser.close();
}
