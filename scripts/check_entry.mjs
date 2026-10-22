import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3200";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local verification only");
// Start the local server with this dedicated test secret. Never use a live token.
const secret = "local-entry-browser-test-only";
const token = exp => {
  const payload = Buffer.from(JSON.stringify({ email: "student@example.com", exp })).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
};
const valid = token(Math.floor(Date.now() / 1000) + 3600);
const cookie = value => ({ cookie: "rubricheck_credit_session=" + value });
const get = (path, headers = {}) => fetch(base + path, { headers, redirect: "manual" });
const directory = "doc/verification/entry";
mkdirSync(directory, { recursive: true });
const checks = [], errors = [], requests = [];
const pass = message => { checks.push(message); console.log("PASS " + message); };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
let signedIn = false;
await context.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  requests.push(url.pathname);
  const data = {
    "/api/account/summary": { signedIn, email: signedIn ? "student@example.com" : null, plan: "free", remainingEvaluations: 3, creditsBalance: 0 },
    "/api/account/preferences": { preferences: null },
    "/api/entitlement": { plan: "free", status: "needs_restore" },
    "/api/trial": { used: false, pending: false, result: null },
    "/api/workspace": { projects: [], assignments: [] },
    "/api/comparison-images": { images: [] },
  };
  if (!Object.hasOwn(data, url.pathname)) { errors.push("Unexpected API: " + url.pathname); return route.fulfill({ status: 503, json: {} }); }
  return route.fulfill({ json: data[url.pathname] });
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
const visit = path => page.goto(base + path, { waitUntil: "networkidle" });
const draftKey = "rubricheck_evaluation_draft_v1";
async function savedDraft(value) { await page.evaluate(({ key, value }) => sessionStorage.setItem(key, value), { key: draftKey, value }); }
try {
  for (const prefix of ["", "/ko", "/ms"]) {
    const home = prefix || "/";
    const response = await get(home);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="sample-feedback"/);
    assert.doesNotMatch(html, /id="rubric-checker"/);
    const query = "?utm_source=google&utm_campaign=essay-feedback";
    const auth = await get(home + query, cookie(valid));
    assert.equal(auth.status, 307, "Authenticated home uses a temporary server redirect");
    assert.equal(new URL(auth.headers.get("location"), base).pathname, prefix + "/workspace");
    assert.equal(new URL(auth.headers.get("location"), base).search, query);
    for (const oldQuery of ["?evaluation_id=11111111-1111-4111-8111-111111111111", "?checkout_session_id=cs_test_entry&evaluation_id=11111111-1111-4111-8111-111111111111", "?evaluation_id=11111111-1111-4111-8111-111111111111&checkout_canceled=1", "?start=general&from=essay-rubric-checker"]) {
      const old = await get(home + oldQuery);
      assert.equal(old.status, 307);
      assert.equal(new URL(old.headers.get("location"), base).pathname, prefix + "/workspace");
      assert.equal(new URL(old.headers.get("location"), base).search, oldQuery);
    }
    assert.equal((await get(prefix + "/product", cookie(valid))).status, 200, "Explicit product visits stay accessible to signed-in users");
    const workspace = await get(prefix + "/workspace");
    assert.equal(workspace.status, 200);
    assert.match(workspace.headers.get("x-robots-tag"), /noindex/);
  }
  for (const invalid of ["not-a-session", valid.slice(0, -1), token(Math.floor(Date.now() / 1000) - 60)]) {
    assert.equal((await get("/", cookie(invalid))).status, 200, "Invalid or expired sessions remain on the landing page");
  }
  pass("Real server routing verifies sessions, keeps public introductions accessible and preserves legacy result/checkout links in all three languages");

  for (const prefix of ["", "/ko", "/ms"]) {
    await context.clearCookies();
    await visit(prefix || "/");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const brand = await page.locator("header a").first().boundingBox();
      const workspaceLink = await page.locator(`header a[href="${prefix}/workspace"]`).boundingBox();
      assert.ok(Math.abs(brand.y + brand.height / 2 - workspaceLink.y - workspaceLink.height / 2) < 2, "Header brand and action share a row");
      assert.equal(await page.locator("main").count(), 1);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("footer").count(), 1);
      assert.equal(await page.locator("#rubric-checker").count(), 0);
      if ([390, 1440].includes(width)) {
        await page.screenshot({ path: join(directory, `${prefix.slice(1) || "en"}-landing-${width}.png`), fullPage: true });
        await page.screenshot({ path: join(directory, `${prefix.slice(1) || "en"}-landing-${width}-viewport.png`) });
      }
    }
    await page.locator('a[href="#sample-feedback"]').click();
    assert.ok(page.url().endsWith("#sample-feedback"));
    await page.locator("#sample-feedback button").first().focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator("#sample-feedback button").first().getAttribute("aria-pressed"), "true");
    assert.equal(requests.some(path => ["/api/evaluate", "/api/grade", "/api/checkout"].includes(path)), false);
    await page.locator(`main a[href="${prefix}/workspace"]`).first().click();
    await page.locator("#rubric-checker").waitFor();
    assert.equal(new URL(page.url()).pathname, prefix + "/workspace");
    assert.equal(await page.getByRole("dialog").count(), 0, "First check is not gated by signup");
  }
  pass("First visits show responsive localized introductions, usable sample feedback and one-click guest access to the workspace");

  await context.clearCookies();
  await visit("/workspace");
  await page.waitForFunction(() => !document.querySelector("#rubric-checker fieldset")?.disabled);
  const rubric = page.getByRole("region", { name: "Rubric", exact: true });
  await rubric.locator('input[type="file"]').first().setInputFiles({ name: "rubric.txt", mimeType: "text/plain", buffer: Buffer.from("Evidence: 100 points") });
  await page.getByRole("group", { name: "Assignment input method" }).getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Assignment", exact: true }).fill("Keep my assignment when I leave the workspace.");
  await page.waitForFunction(key => JSON.parse(sessionStorage.getItem(key)).assignmentText.startsWith("Keep my assignment"), draftKey);
  // The user can navigate to marketing and back without changing storage keys.
  await visit("/");
  assert.equal(new URL(page.url()).pathname, "/");
  await page.getByRole("link", { name: "Continue my draft" }).waitFor();
  await page.screenshot({ path: join(directory, "resume-desktop.png"), fullPage: true });
  await page.getByRole("link", { name: "Continue my draft" }).click();
  await page.waitForFunction(() => !document.querySelector("#rubric-checker fieldset")?.disabled);
  assert.equal(await page.getByRole("textbox", { name: "Assignment", exact: true }).inputValue(), "Keep my assignment when I leave the workspace.");
  await page.getByText("rubric.txt", { exact: false }).first().waitFor();
  pass("A real guest draft and uploaded file survive landing navigation and Continue my draft restores the existing workspace");

  await visit("/");
  const original = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), draftKey);
  for (const value of ["broken json", JSON.stringify({ ...original, savedAt: Date.now() - 25 * 3600000 }), JSON.stringify({ ...original, ownerEmail: "another@example.com" }), JSON.stringify({ ...original, assignmentText: "", rubricText: "", hadRubricFile: false, hadAssignmentFile: false, savedAt: Date.now() })]) {
    await savedDraft(value); await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByRole("link", { name: "Continue my draft" }).count(), 0);
    assert.equal(new URL(page.url()).pathname, "/");
  }
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/", "A repeat visit alone never triggers auto-routing");
  pass("Empty, expired, invalid and other-account drafts do not create a misleading resume action; browsing alone never redirects");

  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await page.getByRole("dialog", { name: "Log in", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/workspace");
  await page.keyboard.press("Escape");
  await visit("/ko?utm_source=google#rubric-checker");
  await page.waitForURL("**/ko/workspace?utm_source=google#rubric-checker");
  await page.locator("#rubric-checker").waitFor();
  pass("Public login opens the existing email dialog and legacy workspace anchors preserve language, query and fragment");

  signedIn = true;
  await visit("/");
  await page.waitForURL("**/workspace");
  pass("A previously cached guest introduction also routes correctly after the account summary confirms login");
  await context.addCookies([{ name: "rubricheck_credit_session", value: valid, url: base }]);
  await visit("/");
  assert.equal(new URL(page.url()).pathname, "/workspace");
  await page.getByRole("button", { name: "student@example.com", exact: true }).waitFor();
  await visit("/product");
  assert.equal(new URL(page.url()).pathname, "/product");
  await page.locator("#sample-feedback").waitFor();
  pass("A signed-in browser enters the workspace directly and can still deliberately view the product introduction");
  assert.deepEqual(errors, []);
  writeFileSync(join(directory, "results.json"), JSON.stringify({ checks, errors, serverSessionVerification: "real HMAC validation with local-only test secret", browserApisMocked: true }, null, 2));
} finally { await browser.close(); }
