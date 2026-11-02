import assert from "node:assert/strict";
import test from "node:test";

import { cleanupOcrText, ensureMeaningfulText, parseFile } from "./parse.ts";

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
