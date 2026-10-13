import assert from "node:assert/strict";
import { test } from "node:test";
import { applyResultTranslation, resultTextFields, translationPrompt } from "./resultTranslation.ts";
import type { FinalEvaluation } from "./gradeFinalization.ts";

const original: FinalEvaluation & { evaluation_id: string } = {
  evaluation_id: "original-id", language: "en", title: "My assignment", access_tier: "pro",
  overall_range: [70, 80], summary: "Summary", top_improvements: ["First", "Second"],
  criteria: [{ name: "Argument", max_score: 100, score: 75, estimated_range: [70, 80],
    rationale: "Rationale", feedback: "Feedback", evidence: ["An exact source quote."],
    detailed_breakdown: "Details", example_revisions: ["Example one", "Example two"] }],
};
test("translation replaces only feedback; scoring, evidence, identity and original stay intact", () => {
  const snapshot = structuredClone(original);
  const translations = resultTextFields(original).map((_, i) => `번역 ${i}`);
  const result = applyResultTranslation(original, { translations }, "ko");
  assert.deepEqual(original, snapshot);
  assert.deepEqual(resultTextFields(result), translations);
  assert.equal(result.language, "ko");
  assert.equal(result.evaluation_id, original.evaluation_id);
  assert.equal(result.title, original.title);
  assert.equal(result.access_tier, original.access_tier);
  assert.deepEqual(result.overall_range, original.overall_range);
  for (const key of ["name", "score", "max_score", "estimated_range", "evidence"] as const)
    assert.deepEqual(result.criteria[0][key], original.criteria[0][key]);
});
test("incomplete, extra or empty model translations are rejected atomically", () => {
  const translations = resultTextFields(original);
  for (const bad of [{ translations: translations.slice(1) }, { translations: [...translations, "extra"] },
    { translations: translations.map(() => " ") }, { translations, overall_range: [99, 100] }, null])
    assert.throws(() => applyResultTranslation(original, bad, "ms"));
  assert.equal(original.summary, "Summary");
});
test("guest translation contains only the preview and keeps its range", () => {
  const preview = { guest_preview: true as const, title: "Essay", summary: "Preview", overall_range: [60, 70] as [number, number] };
  assert.deepEqual(resultTextFields(preview), ["Preview"]);
  assert.deepEqual(applyResultTranslation(preview, { translations: ["Ringkasan"] }, "ms"), { ...preview, summary: "Ringkasan", language: "ms" });
  assert.match(translationPrompt(["untrusted text"], "ms"), /Malay.*Malaysia; not Indonesian/);
  assert.match(translationPrompt(["untrusted text"], "ko"), /Do not grade again/);
});
