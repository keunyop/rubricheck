import assert from "node:assert/strict";
import test from "node:test";
import mammoth from "mammoth";
import { FileParseValidationError, parseFile } from "./parse.ts";
import { docxFixture } from "./testFixtures/docx.ts";

test("DOCX image tables are recovered in reading order even with a long native cover page", async () => {
  const cover = "Course information and student cover sheet. ".repeat(10);
  const file = await docxFixture([cover, { image: "first table" }, "Continued table", { image: "second table" }]);
  const old = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
  assert.ok(old.value.length > 200);
  assert.ok(!old.value.includes("Evidence: 40"));
  for (const field of ["rubric", "assignment"] as const) {
    const calls: string[] = [];
    const text = await parseFile(file, { field, visionOcrClient: { extractText: async params => {
      assert.equal(params.field, field);
      assert.equal(params.allowEmpty, true);
      assert.ok(params.signal);
      const input = Buffer.from(params.imageContentBase64, "base64").toString();
      calls.push(input);
      return input === "first table" ? "Evidence: 40" : "Analysis: 60. Total: 100";
    } } });
    assert.deepEqual(calls, ["first table", "second table"]);
    assert.ok(text.indexOf(cover.trim()) < text.indexOf("Evidence: 40"));
    assert.ok(text.indexOf("Evidence: 40") < text.indexOf("Continued table"));
    assert.ok(text.indexOf("Continued table") < text.indexOf("Analysis: 60"));
  }
});

test("native-only DOCX keeps raw-text output without OCR; image-only DOCX becomes readable", async () => {
  const file = await docxFixture(["A short paragraph.", "Characters < & > stay literal."]);
  const old = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
  assert.equal(await parseFile(file, { visionOcrClient: { extractText: async () => { throw new Error("Unexpected OCR"); } } }), old.value.trim());
  assert.equal(await parseFile(await docxFixture([{ image: "table" }]), {
    visionOcrClient: { extractText: async () => "Quality: 10 points" },
  }), "Quality: 10 points");
});

test("blank decorations are allowed, repeated images reuse OCR, and blank documents still fail", async () => {
  let calls = 0;
  const client = { extractText: async () => { calls++; return ""; } };
  assert.equal(await parseFile(await docxFixture(["Text", { image: "logo" }, { image: "logo" }]), { visionOcrClient: client }), "Text");
  assert.equal(calls, 1);
  await assert.rejects(parseFile(await docxFixture([{ image: "blank" }]), { visionOcrClient: client }), /TEXT_EXTRACTION_FAILED/);
});

test("embedded image failures cannot silently return just the native cover text", async () => {
  const file = await docxFixture(["Readable cover page", { image: "table" }]);
  for (const code of ["GOOGLE_VISION_OCR_UNAVAILABLE", "TEXT_EXTRACTION_FAILED"]) {
    await assert.rejects(parseFile(file, { visionOcrClient: { extractText: async () => { throw new Error(code); } } }), { message: code });
  }
  await assert.rejects(parseFile(new File(["invalid zip"], "bad.docx")), FileParseValidationError);
  let calls = 0;
  await assert.rejects(parseFile(await docxFixture(["Cover", { image: "external", external: true }]), {
    visionOcrClient: { extractText: async () => { calls++; return "must not read"; } },
  }), { message: "EXTERNAL_DOCX_IMAGE" });
  assert.equal(calls, 0);
});

test("DOCX OCR has a shared deadline and a bounded image count", async t => {
  const deadline = new AbortController();
  t.mock.method(AbortSignal, "timeout", () => deadline.signal);
  let calls = 0;
  await assert.rejects(parseFile(await docxFixture([{ image: "first" }, { image: "second" }]), {
    visionOcrClient: { extractText: async ({ signal }) => { calls++; assert.equal(signal, deadline.signal); deadline.abort(); return "First"; } },
  }), /GOOGLE_VISION_OCR_UNAVAILABLE/);
  assert.equal(calls, 1);
  t.mock.restoreAll();
  calls = 0;
  await assert.rejects(parseFile(await docxFixture(Array.from({ length: 51 }, (_, i) => ({ image: String(i) }))), {
    visionOcrClient: { extractText: async () => { calls++; return ""; } },
  }), FileParseValidationError);
  assert.equal(calls, 50);
});
