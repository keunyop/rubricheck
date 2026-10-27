import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SEO_LANDING_PAGES } from "../config/seoPages.ts";

test("each new language has complete, distinct guide content and worked examples", () => {
  const translations = JSON.parse(readFileSync(new URL("./seoGuideDetails.json", import.meta.url), "utf8"));
  for (const locale of ["hi", "ur", "vi", "zh"]) {
    const sectionBodies = new Set<string>();
    for (const page of SEO_LANDING_PAGES) {
      const translated = translations[locale]?.[page.slug];
      assert.ok(translated, `${locale}: ${page.slug}`);
      assert.equal(translated.sections.length, page.sections.length, `${locale}: ${page.slug} sections`);
      for (const [index, section] of translated.sections.entries()) {
        assert.ok(section.title.trim() && section.body.trim(), `${locale}: ${page.slug} section ${index}`);
        assert.notEqual(section.body, page.sections[index].body, `${locale}: ${page.slug} section must be localized`);
        assert.ok(!section.body.includes("\ufffd"), `${locale}: ${page.slug} encoding`);
        assert.ok(!sectionBodies.has(section.body), `${locale}: guide sections should not repeat`);
        sectionBodies.add(section.body);
      }
      assert.equal(translated.example.columns.length, 3, `${locale}: ${page.slug} example columns`);
      assert.equal(translated.example.rows.length, page.example.rows.length, `${locale}: ${page.slug} example rows`);
      for (const row of translated.example.rows) assert.ok(row.length === 3 && row.every((cell: string) => cell.trim()), `${locale}: ${page.slug} example row`);
      for (const field of ["title", "description", "note"]) assert.ok(translated.example[field].trim(), `${locale}: ${page.slug} example ${field}`);
    }
  }
});
