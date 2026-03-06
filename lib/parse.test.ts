import assert from "node:assert/strict";
import test from "node:test";

import { cleanupOcrText, ensureMeaningfulText, parseFile } from "./parse.ts";

test("ensureMeaningfulText throws for near-empty extracted text", () => {
  assert.throws(() => ensureMeaningfulText("short text", "sample.pdf"), /TEXT_EXTRACTION_FAILED/);
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
