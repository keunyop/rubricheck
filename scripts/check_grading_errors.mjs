import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links)
    .map(name => readFileSync(join(links, name), "utf8").trim()).find(candidate => existsSync(candidate));
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local server");
const browser = await chromium.launch({ headless: true });
const result = {
  title: "Evaluation Summary", access_tier: "free", overall_range: [70, 85],
  summary: "A clear argument that would benefit from supporting evidence.",
  top_improvements: ["Add evidence to support the argument."],
  criteria: [{ name: "Overall quality", max_score: 100, score: 78, estimated_range: [70, 85],
    feedback: "Add evidence to support the argument.", detailed_breakdown_locked: true }],
};

try {
  for (const locale of ["en", "ko"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const pageErrors = [], attempts = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    let nextCode = "RUBRIC_STRUCTURE_FAILED";
    // Keep browser regression checks isolated from real accounts and analytics.
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      let json = {}, status = 200;
      if (url.pathname === "/api/account/summary") json = { signedIn: true, email: "test@example.com", plan: "free", remainingEvaluations: 3, creditsBalance: 0 };
      else if (url.pathname === "/api/account/preferences") json = { preferences: { siteLanguage: locale, resultLanguage: "en" } };
      else if (url.pathname === "/api/entitlement") json = { plan: "free", status: "needs_restore" };
      else if (url.pathname === "/api/workspace") json = { projects: [], assignments: [] };
      else if (url.pathname === "/api/comparison-images") json = { images: [] };
      else if (url.pathname === "/api/trial") json = { used: false, pending: false, result: null };
      else if (url.pathname === "/api/evaluate") {
        attempts.push({ key: request.headers()["idempotency-key"], input: request.postDataJSON() });
        status = nextCode === "RUBRIC_STRUCTURE_FAILED" ? 400 : ["RUBRIC_MODEL_UNAVAILABLE", "OCR_UNAVAILABLE"].includes(nextCode) ? 503 : nextCode ? 500 : 200;
        json = nextCode ? { code: nextCode, requestId: "browser-test" } : result;
      } else if (url.pathname.startsWith("/api/growth/")) json = { ok: true };
      else throw new Error("Unexpected API: " + url.pathname);
      await route.fulfill({ status, json });
    });
    await page.goto(base + (locale === "en" ? "/workspace" : "/ko/workspace"));
    const textLabel = locale === "en" ? "Text" : "텍스트";
    await page.getByRole("button", { name: textLabel, exact: true }).first().click();
    await page.getByRole("button", { name: textLabel, exact: true }).nth(1).click();
    const rubric = page.locator('textarea[aria-labelledby="rubric-input-title"]');
    const assignment = page.locator('textarea[aria-labelledby="assignment-input-title"]');
    await rubric.fill("Overall quality: 100 points. Assess clarity and support.");
    await assignment.fill("Schools should start later so students can get enough sleep and concentrate better.");
    const submit = page.getByRole("button", { name: locale === "en" ? "Grade my assignment" : "내 과제 채점하기", exact: true });
    for (const [code, message] of [
      ["RUBRIC_STRUCTURE_FAILED", locale === "en" ? /We could not read the grading criteria/ : /채점 기준을 읽지 못했습니다/],
      ["RUBRIC_MODEL_UNAVAILABLE", locale === "en" ? /Service is temporarily unavailable/ : /일시적으로 서비스를 이용할 수 없습니다/],
      ["OCR_UNAVAILABLE", locale === "en" ? /Image OCR is temporarily unavailable/ : /현재 이미지의 글자를 읽을 수 없습니다/],
      ["EVALUATION_FAILED", locale === "en" ? /We could not finish grading this assignment/ : /과제 채점을 완료하지 못했습니다/],
    ]) {
      nextCode = code;
      await submit.click();
      await page.getByText(message).waitFor();
      assert.equal(await page.getByRole("button", { name: locale === "en" ? "Swap rubric and assignment" : "루브릭과 과제 서로 바꾸기", exact: true }).count(), 0,
        "technical failures must not suggest swapping inputs");
      assert.equal(await rubric.inputValue(), attempts[0].input.rubricText);
      assert.equal(await assignment.inputValue(), attempts[0].input.assignmentText);
      assert.ok(attempts[0].key);
      assert.equal(attempts.at(-1).key, attempts[0].key, "Retries preserve idempotency");
      assert.equal(await page.getByText(locale === "en" ? "Something went wrong. Please try again." : "문제가 발생했습니다. 다시 시도해 주세요.", { exact: true }).count(), 0);
      console.log(`PASS ${locale}: ${code} gives actionable guidance and keeps inputs`);
    }
    nextCode = "";
    await submit.click();
    await page.getByText(result.summary, { exact: true }).waitFor();
    await page.getByText("Overall quality", { exact: true }).first().waitFor();
    assert.equal(attempts.length, 5);
    assert.equal(attempts.at(-1).key, attempts[0].key);
    assert.deepEqual(pageErrors, []);
    console.log(`PASS ${locale}: retry displays a single-criterion grading result`);
    await context.close();
  }
} finally {
  await browser.close();
}
