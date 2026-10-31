import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFile } from "./parse.ts";
import { makePdf } from "./testFixtures/pdf.ts";

const longText = "Synthetic rubric: explain the claim, support it with evidence, and write a clear conclusion. ".repeat(4).trim();

test("PDF extraction recovers scanned pages without truncating or changing native text", async (t) => {
  const previous = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  process.env.GOOGLE_CLOUD_VISION_API_KEY = "test-key";
  const batches: number[][] = [];
  let reply: (pages: number[]) => unknown = pages => ({ responses: [{ responses: pages.map(pageNumber => ({ context: { pageNumber }, fullTextAnnotation: { text: `Page ${pageNumber}: ${longText}` } })) }] });
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://vision.googleapis.com/v1/files:annotate");
    const body = JSON.parse(String(init?.body));
    const request = body.requests[0];
    assert.equal(request.inputConfig.mimeType, "application/pdf");
    assert.match(Buffer.from(request.inputConfig.content, "base64").toString(), /^%PDF-/);
    assert.equal(request.features[0].type, "DOCUMENT_TEXT_DETECTION");
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-key");
    batches.push(request.pages);
    return Response.json(reply(request.pages));
  });
  try {
    await t.test("two-page scan is read by OCR", async () => {
      const text = await parseFile(makePdf(["", ""]), { field: "rubric" });
      assert.match(text, /Page 1:/);
      assert.match(text, /Page 2:/);
      assert.deepEqual(batches.pop(), [1, 2]);
    });
    await t.test("more than five pages are explicitly batched in order", async () => {
      batches.length = 0;
      const text = await parseFile(makePdf(Array(7).fill("")));
      assert.deepEqual(batches, [[1, 2, 3, 4, 5], [6, 7]]);
      assert.ok(text.indexOf("Page 1:") < text.indexOf("Page 7:"));
    });
    await t.test("native text needs no OCR", async () => {
      batches.length = 0;
      assert.equal(await parseFile(makePdf([longText])), longText);
      assert.equal(batches.length, 0);
    });
    await t.test("mixed PDF keeps native text and reads the scanned page", async () => {
      batches.length = 0;
      const text = await parseFile(makePdf([longText, ""]));
      assert.match(text, /Page 2:/);
      assert.ok(text.startsWith(longText));
      assert.deepEqual(batches, [[2]]);
    });
    await t.test("missing pages and page-level outages never become a partial success", async () => {
      for (const result of [{ responses: [{ responses: [] }] }, { responses: [{ responses: [{ error: { code: 8 } }] }] }]) {
        reply = () => result;
        await assert.rejects(parseFile(makePdf([""])), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      }
    });
    await t.test("reordered pages retain document order and duplicate pages are rejected", async () => {
      reply = pages => ({ responses: [{ responses: [...pages].reverse().map(pageNumber => ({ context: { pageNumber }, fullTextAnnotation: { text: `Page ${pageNumber}: ${longText}` } })) }] });
      const text = await parseFile(makePdf(["", ""]));
      assert.ok(text.indexOf("Page 1:") < text.indexOf("Page 2:"));
      reply = () => ({ responses: [{ responses: [1, 1].map(pageNumber => ({ context: { pageNumber }, fullTextAnnotation: { text: longText } })) }] });
      await assert.rejects(parseFile(makePdf(["", ""])), /GOOGLE_VISION_OCR_UNAVAILABLE/);
    });
    await t.test("blank companion pages do not invalidate a readable document", async () => {
      reply = () => ({ responses: [{ responses: [{}] }] });
      assert.equal(await parseFile(makePdf([longText, ""])), longText);
    });
    await t.test("missing OCR credentials and deadline expiry remain service errors", async (deadlineTest) => {
      delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
      await assert.rejects(parseFile(makePdf([""])), /GOOGLE_VISION_OCR_UNAVAILABLE/);
      process.env.GOOGLE_CLOUD_VISION_API_KEY = "test-key";
      deadlineTest.mock.method(AbortSignal, "timeout", (ms: number) => {
        assert.equal(ms, 60_000);
        return AbortSignal.abort();
      });
      deadlineTest.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
        init?.signal?.throwIfAborted();
        throw new Error("unexpected request");
      });
      await assert.rejects(parseFile(makePdf([""])), /GOOGLE_VISION_OCR_UNAVAILABLE/);
    });
    await t.test("unreadable files and empty OCR remain input failures", async () => {
      reply = () => ({ responses: [{ responses: [{}] }] });
      await assert.rejects(parseFile(makePdf([""])), /TEXT_EXTRACTION_FAILED/);
      await assert.rejects(parseFile(new File(["invalid"], "broken.pdf")), /Invalid or unreadable PDF/);
    });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_CLOUD_VISION_API_KEY;
    else process.env.GOOGLE_CLOUD_VISION_API_KEY = previous;
  }
});
