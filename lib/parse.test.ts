import assert from "node:assert/strict";
import test from "node:test";

import { cleanupOcrText, ensureMeaningfulText, parseFile } from "./parse.ts";
import { docxFixture } from "./testFixtures/docx.ts";

test("extraction accepts short readable text while rejecting blank and nontext content", () => {
  for (const text of ["Explain the reasoning and support it with evidence.", "근거를 제시하세요.", "支持论点。", "x = 2 + 3"]) {
    assert.equal(ensureMeaningfulText(text, "sample.pdf"), text);
  }
  for (const text of ["", " \n\t", "--- ... !!!", "- ".repeat(200), "x" + "-".repeat(200)]) {
    assert.throws(() => ensureMeaningfulText(text, "sample.pdf"), /TEXT_EXTRACTION_FAILED/);
  }
});

test("cleanupOcrText keeps rubric lines and normalizes bullets", () => {
  const cleaned = cleanupOcrText("Criteria 1  \n- Clarity   \n* Evidence", "rubric");
  assert.equal(cleaned, "Criteria 1\n- Clarity\n- Evidence");
});

test("cleanupOcrText de-hyphenates assignment line wraps", () => {
  const cleaned = cleanupOcrText("This assign-\nment is   clear.\n\n\nNext line.", "assignment");
  assert.equal(cleaned, "This assignment is clear.\n\nNext line.");
});

test("parseFile supports image OCR path with injected client", async () => {
  const file = new File(["fake"], "essay.jpg", { type: "image/jpeg" });
  const repeatedSentence = "This is extracted OCR text for assignment grading quality checks. ";
  const ocrText = repeatedSentence.repeat(6);

  const parsed = await parseFile(file, {
    field: "assignment",
    visionOcrClient: {
      extractText: async ({ field }) => {
        assert.equal(field, "assignment");
        return ocrText;
      },
    },
  });

  assert.equal(parsed, ocrText.trim());
});

test("a short single-image rubric uses the same readable-text validation as other input", async () => {
  const text = "Explain the proposal clearly; evaluate its strengths and limitations.";
  assert.ok(text.length < 200);
  for (const field of ["rubric", "assignment"] as const) {
    assert.equal(await parseFile(new File(["synthetic"], "short.png"), {
      field, visionOcrClient: { extractText: async () => text },
    }), text);
  }
});

test("protected DOCX containers are identified before generic ZIP parsing", async () => {
  const intune = Buffer.concat([Buffer.from([0]), Buffer.from("MSMAMARPCRYPT\0\0AES/CBC/NoPadding"), Buffer.alloc(32)]);
  const officeEncrypted = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(32)]);

  for (const [bytes, name] of [[intune, "managed.docx"], [officeEncrypted, "password-protected.docx"]] as const) {
    await assert.rejects(
      parseFile(new File([bytes], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
      { message: "PROTECTED_FILE" },
    );
  }
});

test("tiny images with no readable OCR get specific guidance while readable small images remain accepted", async () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(105, 16);
  png.writeUInt32BE(70, 20);
  const file = new File([png], "thumbnail.png", { type: "image/png" });

  assert.equal(await parseFile(file, {
    field: "rubric",
    visionOcrClient: { extractText: async () => "Thesis: 10 points" },
  }), "Thesis: 10 points");
  await assert.rejects(parseFile(file, {
    field: "rubric",
    visionOcrClient: { extractText: async () => { throw new Error("TEXT_EXTRACTION_FAILED"); } },
  }), { message: "IMAGE_TOO_SMALL" });
});

test("DOCX parsing preserves native and raster text when a Word-only vector image is present", async () => {
  const file = await docxFixture([
    "Thesis: 10 points. State a clear argument.",
    { image: "unsupported vector", extension: "emf", contentType: "image/x-emf" },
    { image: "supported raster", extension: "png", contentType: "image/png" },
  ]);
  let calls = 0;
  const parsed = await parseFile(file, {
    field: "rubric",
    visionOcrClient: { extractText: async ({ imageContentBase64 }) => {
      calls++;
      assert.equal(Buffer.from(imageContentBase64, "base64").toString(), "supported raster");
      return "Evidence: 5 points";
    } },
  });

  assert.equal(calls, 1);
  assert.match(parsed, /Thesis: 10 points[\s\S]*Evidence: 5 points/);
});
