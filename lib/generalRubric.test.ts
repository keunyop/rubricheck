import assert from "node:assert/strict";
import { test } from "node:test";
import { generalRubric } from "./generalRubric.ts";
import { RubricSchema } from "./schema.ts";

test("general criteria are deterministic, valid, and independent across requests", () => {
  const baseline = generalRubric();
  assert.equal(RubricSchema.safeParse(baseline).success, true);
  assert.equal(baseline.criteria.reduce((total, row) => total + row.max_score, 0), 100);
  const specified = generalRubric("  Compare two sources.  ");
  assert.match(specified.criteria[0].description, /"Compare two sources."/);
  specified.criteria[1].max_score = 500;
  assert.deepEqual(generalRubric(), baseline);
  assert.match(baseline.criteria[0].description, /Do not invent assignment requirements/);
});
