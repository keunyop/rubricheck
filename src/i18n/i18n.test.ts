import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocale, localizedPath, localeFromPath } from "./config.ts";
import { messages } from "./messages.ts";
import { translate } from "./translate.ts";
import { buildEvaluationPrompt } from "../../lib/evaluationPrompt.ts";

test("localized routes retain query strings, fragments and private endpoints", () => {
  for (const [source, expected] of [["/", "/ms"], ["/ko/pricing?x=1#plans", "/ms/pricing?x=1#plans"],
    ["/api/grade", "/api/grade"], ["/admin", "/admin"], ["/billing/manage", "/billing/manage"],
    ["https://example.com", "https://example.com"], ["//example.com", "//example.com"]])
    assert.equal(localizedPath(source, "ms"), expected);
  assert.equal(localizedPath("/ko?evaluation_id=123", "en"), "/?evaluation_id=123");
  assert.equal(localeFromPath("/ko/pricing"), "ko");
  assert.equal(isLocale("id"), false);
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
  for (const [locale, language] of [["en", "English"], ["ko", "Korean"], ["ms", "Malay"]] as const) {
    const prompt = buildEvaluationPrompt(rubric, "Untrusted assignment text", "standard", "diagnostic", locale);
    assert.ok(prompt.includes(language));
    assert.ok(prompt.includes("Untrusted assignment text"));
  }
});
