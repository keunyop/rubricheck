import assert from "node:assert/strict";
import test from "node:test";
import { parseFile } from "./parse";
import { auditRubricSource } from "./rubricSource";
import { makePositionedPdf } from "./testFixtures/pdf";

function weightagePdf(total = 24) {
  const items: { text: string; x: number; y: number }[] = [];
  const put = (text: string, y: number, x = 50) => items.push({ text, x, y });
  put("Criteria and ratings", 740);
  put("(0) Not shown", 727);
  put("(1) Starting", 714);
  put("(2) Developing", 701);
  put("(3) Meets", 688);
  put("(4)", 675);
  put("Weightage", 678, 340);
  put("Marks", 678, 430);
  put("Total Marks", 678, 490);
  put("1. Measurements", 656);
  put("Compare the recorded readings from both trials and retain their units.", 640);
  put("3.5", 620, 350);
  put("0", 620, 505);
  put("2. Explanation", 600);
  put("Identify a plausible source of variation and discuss its effect on the results.", 584);
  put("2.5", 564, 350);
  put("0", 564, 505);
  put(`Total marks (/${total} marks)`, 540, 350);
  put("0", 540, 505);
  return makePositionedPdf(items);
}

test("single-page rubric PDF separates native column gaps and preserves explicit weighted maxima", async () => {
  const recovered = await parseFile(weightagePdf(), { field: "rubric" });
  const audit = auditRubricSource(recovered);
  assert.equal(audit.layout, "weightage");
  assert.deepEqual(audit.rowMaxima, [14, 10]);
  assert.deepEqual(audit.statedTotals, [24]);
  assert.match(audit.rubric!.criteria[0].description, /retain their units/);
  assert.match(audit.rubric!.criteria[1].description, /source of variation/);
});

test("assignment text stays unchanged and a contradictory PDF total does not activate rubric recovery", async () => {
  const assignment = await parseFile(weightagePdf(), { field: "assignment" });
  const baseline = await parseFile(weightagePdf(28), { field: "assignment" });
  const contradictory = await parseFile(weightagePdf(28), { field: "rubric" });
  assert.equal(auditRubricSource(assignment).kind, "unknown");
  assert.equal(contradictory, baseline);
  assert.equal(auditRubricSource(contradictory).kind, "unknown");
});
