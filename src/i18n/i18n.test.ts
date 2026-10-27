import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocale, localizedPath, localeFromPath, shouldRestoreSiteLanguage } from "./config.ts";
import { messages } from "./messages.ts";
import { newLanguages } from "./newLanguages.ts";
import { translate } from "./translate.ts";
import { buildEvaluationPrompt } from "../../lib/evaluationPrompt.ts";

test("localized routes retain query strings, fragments and private endpoints", () => {
  for (const [source, expected] of [["/", "/ms"], ["/ko/pricing?x=1#plans", "/ms/pricing?x=1#plans"],
    ["/api/grade", "/api/grade"], ["/admin", "/admin"], ["/billing/manage", "/billing/manage"],
    ["https://example.com", "https://example.com"], ["//example.com", "//example.com"]])
    assert.equal(localizedPath(source, "ms"), expected);
  assert.equal(localizedPath("/ko?evaluation_id=123", "en"), "/?evaluation_id=123");
  assert.equal(localeFromPath("/ko/pricing"), "ko");
  for (const locale of ["hi", "ur", "vi", "zh"] as const) {
    assert.equal(localizedPath(`/${locale}/pricing?x=1`, "en"), "/pricing?x=1");
    assert.equal(localeFromPath(`/${locale}/pricing`), locale);
  }
  assert.equal(isLocale("id"), false);
});
test("new translations retain placeholders and never fall back to another language", () => {
  const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const source of Object.keys(messages)) assert.ok(source in newLanguages, `Missing translation: ${source}`);
  for (const [source, translations] of Object.entries(newLanguages)) {
    assert.ok(source in messages, source);
    assert.equal(translations.length, 4, source);
    for (const translation of translations) {
      assert.ok(translation.trim(), source);
      assert.ok(!translation.includes("\ufffd"), source);
      assert.deepEqual(placeholders(translation), placeholders(source), source);
    }
  }
  for (const locale of ["hi", "ur", "vi", "zh"] as const) assert.equal(translate(locale, "Unknown message"), "Unknown message");
});
test("explicit public language URLs take precedence over account and browser defaults", () => {
  for (const path of ["/ko", "/ko/", "/ms", "/ko/workspace", "/ms/workspace", "/ko/rubric-checker", "/ms/pricing", "/rubric-checker", "/pricing", "/legal/privacy"])
    assert.equal(shouldRestoreSiteLanguage(path), false, path);
  for (const path of ["/", "/workspace", "/billing/manage", "/admin"])
    assert.equal(shouldRestoreSiteLanguage(path), true, path);
});
test("every translation has both languages and retains all named placeholders", () => {
  const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [source, values] of Object.entries(messages)) {
    assert.equal(values.length, 2, source);
    for (const value of values) {
      assert.ok(value.trim(), source);
      assert.deepEqual(placeholders(value), placeholders(source), source);
      assert.ok(!value.includes("\ufffd"), source);
    }
  }
  assert.equal(translate("en", "Unknown message"), "Unknown message");
});
test("grading explicitly requests the target feedback language independently of source text", () => {
  const rubric = { criteria: [{ name: "Argument", max_score: 100, description: "Clarity" }] };
  for (const [locale, language] of [["en", "English"], ["ko", "Korean"], ["ms", "Malay"], ["hi", "Hindi"], ["ur", "Urdu"], ["vi", "Vietnamese"], ["zh", "Simplified Chinese"]] as const) {
    const prompt = buildEvaluationPrompt(rubric, "Untrusted assignment text", "standard", "diagnostic", locale);
    assert.ok(prompt.includes(language));
    assert.ok(prompt.includes("Untrusted assignment text"));
  }
});
