import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath && process.env.LOCALAPPDATA) {
  const links = join(process.env.LOCALAPPDATA, "ms-playwright", ".links");
  if (existsSync(links)) modulePath = readdirSync(links).map(name => readFileSync(join(links, name), "utf8").trim()).find(existsSync);
}
if (modulePath && !/\.m?js$/.test(modulePath)) modulePath = join(modulePath, "index.mjs");
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const browser = await chromium.launch({ headless: true });
const draft = "An original draft about a social issue.\nA second paragraph with supporting evidence.";
const instructions = "Describe the background of the issue, use formal academic language, and move from a broad overview to a specific research context.";
const result = {
  title: "Evaluation Summary", access_tier: "free", overall_range: [70, 85],
  summary: "The corrected inputs were graded successfully.", top_improvements: ["Develop the background."],
  criteria: [{ name: "Background", max_score: 100, score: 78, estimated_range: [70, 85], feedback: "Develop the background.", detailed_breakdown_locked: true }],
};
async function readInputs(request) {
  if (request.headers()["content-type"].includes("application/json")) return request.postDataJSON();
  const form = await new Request(base, { method: "POST", headers: { "content-type": request.headers()["content-type"] }, body: request.postDataBuffer() }).formData();
  const data = {};
  for (const field of ["rubric", "assignment", "rubricText", "assignmentText"]) {
    const values = form.getAll(field);
    if (!values.length) continue;
    data[field] = typeof values[0] === "string" ? values[0] : await Promise.all(values.map(async file => ({ name: file.name, type: file.type, content: Buffer.from(await file.arrayBuffer()).toString("base64") })));
  }
  return data;
}

try {
  for (const locale of ["en", "ko", "ms"]) for (const [rubricMode, assignmentMode] of [["text", "file"], ["file", "text"], ["text", "text"], ["file", "file"]]) {
    const context = await browser.newContext({ viewport: { width: locale === "ko" ? 390 : 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [], attempts = [];
    page.on("pageerror", error => errors.push(error.message));
    let code = "RUBRIC_CRITERIA_NOT_FOUND";
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
        attempts.push({ key: request.headers()["idempotency-key"], inputs: await readInputs(request) });
        status = code ? 400 : 200;
        json = code ? { code, details: { field: "rubric" }, requestId: "swap-browser-test" } : result;
      } else if (url.pathname.startsWith("/api/growth/")) json = { ok: true };
      else throw new Error("Unexpected API: " + url.pathname);
      await route.fulfill({ status, json });
    });
    try {
      await page.goto(base + (locale === "en" ? "/workspace" : `/${locale}/workspace`));
      for (const [field, mode, text] of [["rubric", rubricMode, draft], ["assignment", assignmentMode, instructions]]) {
        const section = page.locator(`section[aria-labelledby="${field}-input-title"]`);
        await section.locator('[role="group"] button').nth(mode === "text" ? 1 : 0).click();
        if (mode === "text") await section.locator("textarea").fill(text);
        else await section.locator('input[type="file"][multiple]').setInputFiles([1, 2].map(index => ({ name: `${field}-${index}.png`, mimeType: "image/png", buffer: Buffer.from(`${field} image ${index}`) })));
      }
      const submit = page.locator('#rubric-checker button[type="submit"]');
      await submit.click();
      const swap = page.getByRole("button", { name: { en: "Swap rubric and assignment", ko: "루브릭과 과제 서로 바꾸기", ms: "Tukar tempat rubrik dan tugasan" }[locale], exact: true });
      await swap.waitFor();
      const alert = page.getByRole("alert").filter({ has: swap });
      assert.ok((await alert.innerText()).includes({ en: "No grading criteria", ko: "채점 기준을 찾지 못했습니다", ms: "Tiada kriteria" }[locale]));
      assert.equal(await alert.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await swap.click();
      await swap.waitFor({ state: "hidden" });
      assert.equal(attempts.length, 1, "swapping must not start grading automatically");
      await page.waitForFunction(({ rubricMode, assignmentMode }) => {
        const state = JSON.parse(sessionStorage.getItem("rubricheck_evaluation_draft_v1") || "null");
        return state?.rubricMode === assignmentMode && state?.assignmentMode === rubricMode;
      }, { rubricMode, assignmentMode });
      // A manual second attempt verifies all multipart bytes and file order after swapping.
      await submit.click();
      await swap.waitFor();
      const first = attempts[0], second = attempts[1];
      assert.notEqual(second.key, first.key, "corrected inputs get a new idempotency key");
      assert.deepEqual(second.inputs.rubric, first.inputs.assignment);
      assert.deepEqual(second.inputs.assignment, first.inputs.rubric);
      assert.equal(second.inputs.rubricText, first.inputs.assignmentText);
      assert.equal(second.inputs.assignmentText, first.inputs.rubricText);
      // Wait for the browser's existing file persistence queue by reading the saved draft.
      if (rubricMode === "file" || assignmentMode === "file") {
        await page.waitForFunction(async expectedRubric => {
          const db = await new Promise((resolve, reject) => { const req = indexedDB.open("rubricheck_drafts", 1); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
          try {
            if (!db.objectStoreNames.contains("files")) return false;
            const rows = await new Promise((resolve, reject) => { const req = db.transaction("files").objectStore("files").getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
            return rows.some(row => row.rubric?.map(file => file.name).join(",") === expectedRubric);
          } finally { db.close(); }
        }, second.inputs.rubric?.map(file => file.name).join(",") ?? "");
      }
      await page.reload();
      code = "";
      await submit.click();
      await page.getByText(result.summary, { exact: true }).waitFor();
      assert.equal(attempts.length, 3);
      assert.deepEqual(attempts[2].inputs, second.inputs, "corrected inputs survive reload");
      assert.deepEqual(errors, []);
      console.log(`PASS ${locale} ${rubricMode}/${assignmentMode}: guidance, explicit swap, file order/bytes, new retry key, reload and success`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
