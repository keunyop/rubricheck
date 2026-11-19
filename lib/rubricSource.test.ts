import assert from "node:assert/strict";
import test from "node:test";

import { auditRubricSource } from "./rubricSource";
import { structureRubric } from "./rubricStructuring";

// Newly authored examples exercise layouts, independent of captured submissions.
const lmsSource = [
  "Instructions: Explain the design decisions and cite reliable sources.",
  "Criteria\tRatings\tPts",
  ...[["Design", 12], ["Testing", 18], ["Discussion EXTRA CREDIT", 10]].map(([name, maximum]) => [
    `This criterion is linked to a Learning Outcome ${name}`,
    `${maximum} pts`, "Excellent", "Assess the quality of the work.", `${maximum} pts`,
  ].join("\n")),
  "This criterion is linked to a Learning Outcome Team awareness",
  "Explain who benefits from the design.", "threshold: 3 pts", "4 pts", "Mastery", "3 pts", "Developing", "--",
  "Total Points: 40",
].join("\n");

test("LMS terminal Pts cells determine weights, preserving unscored ratings and supporting instructions", () => {
  const result = auditRubricSource(lmsSource);
  assert.equal(result.kind, "scored");
  assert.equal(result.rubric?.total_score, 40);
  assert.deepEqual(result.rubric?.criteria.map(row => row.max_score), [12, 18, 10]);
  assert.equal(result.rubric?.adjustments, undefined);
  assert.match(result.rubric!.criteria[0].description, /cite reliable sources/);
  assert.match(result.rubric!.criteria.at(-1)!.description, /who benefits/);
  assert.equal(result.rubric?.criteria.length, 3);
});

test("LMS mixed-case labels, multi-rating rows and alternate unscored markers preserve score semantics", () => {
  for (const unscored of ["--", "—", "N/A"]) {
    const source = lmsSource.replace("12 pts\nExcellent", "12 pts\nExcellent\n6 pts\nSatisfactory\n0 pts\nMissing")
      .replace("--\nTotal", `${unscored}\nTotal`).replaceAll("This criterion", "THIS CRITERION");
    const result = auditRubricSource(source);
    assert.equal(result.rubric?.total_score, 40);
    assert.deepEqual(result.rowMaxima, [12, 18, 10]);
  }
});

test("identical scored rows are never deduplicated into a false source conflict", () => {
  const row = "This criterion is linked to a Learning Outcome Reflection\n10 pts\nExcellent\nAssess reflection.\n10 pts";
  const source = `Criteria\tRatings\tPts\n${row}\n${row}\nTotal Points: 20`;
  assert.equal(auditRubricSource(source).kind, "unknown");
});

test("ambiguous LMS point cells defer to extraction instead of inventing row maxima", () => {
  const source = lmsSource.replace("18 pts\nThis criterion", "\nThis criterion");
  // There is still a rating of 18, but the actual points cell is text.
  assert.equal(auditRubricSource(source).kind, "unknown");
});

test("independent LMS section totals never become a false overall points conflict", () => {
  const source = "Criteria Ratings Pts\nReport\nThis criterion is linked to a Learning Outcome Evidence\n5 pts\nExcellent\n5 pts\nTotal Points:5\nPresentation\nThis criterion is linked to a Learning Outcome Delivery\n5 pts\nExcellent\n5 pts\nTotal Points:5\nOverall total:10";
  assert.equal(auditRubricSource(source).kind, "unknown");
});

test("percentage row maxima preserve general descriptions and unscored completion requirements", () => {
  const source = [
    "General Description: Reflect critically using specific examples.", "Strong (70-100%)", "Pass (40-69%)",
    "Research (35%)", "Use credible sources.", "25-35 marks", "/35",
    "Analysis (45%)", "Explain the evidence.", "30-45 marks", "/45",
    "Style (20%)", "Write clearly.", "/20", "AI declaration: Complete Y/N; state any tools used.",
  ].join("\n");
  const result = auditRubricSource(source);
  assert.equal(result.rubric?.total_score, 100);
  assert.deepEqual(result.rowMaxima, [35, 45, 20]);
  assert.match(result.rubric!.criteria[0].description, /General Description/);
  assert.match(result.rubric!.criteria[2].description, /AI declaration/);
  assert.equal(result.rubric!.criteria.length, 3);
});

test("mismatched percentage maxima defer rather than silently correcting weights", () => {
  assert.equal(auditRubricSource("A (60%)\n/60\nB (40%)\n/30").kind, "unknown");
  assert.equal(auditRubricSource("A (60%)\n/60\nB (30%)\n/30").kind, "unknown");
  assert.equal(auditRubricSource("Research(60%)\n/60\nWriting(40%)\n/40\nOverall total: 100\nThe raw grade is converted to a final mark out of 20.\nTotal\n20").kind, "unknown");
});

test("whole-assessment grade bands retain one shared maximum and all dimensions", () => {
  for (const scale of [20, 30]) {
    const source = `Reasoning | Source use | Clarity\nF\n0-${scale / 2}\nWeak reasoning and evidence.\nC\n${scale / 2 + 0.5}-${scale - 3}\nSound reasoning.\nA\n${scale - 2.5}-${scale}\nStrong reasoning, credible sources and clear prose.`;
    const result = auditRubricSource(source);
    assert.equal(result.kind, "holistic");
    assert.equal(result.rubric?.total_score, scale);
    assert.equal(result.rubric?.criteria.length, 1);
    assert.equal(result.rubric?.criteria[0].max_score, scale);
    assert.equal(result.rubric?.criteria[0].description, source);
  }
});

test("overlapping grade ranges are not treated as a reliable holistic scale", () => {
  assert.equal(auditRubricSource("F\n0-10\nC\n8-15\nA\n14-20").kind, "unknown");
  assert.equal(auditRubricSource("Each criterion uses the following scale.\nMaximum points\nF\n0-8\nC\n9-15\nA\n16-20").kind, "unknown");
  assert.equal(auditRubricSource("Research (60%)\nF\n0-8\nC\n9-15\nA\n16-20").kind, "unknown");
  assert.equal(auditRubricSource("Score Reasoning, Evidence, and Clarity separately using this scale for each criterion. Each criterion is worth 20 marks.\nF\n0-8\nC\n9-15\nA\n16-20").kind, "unknown");
});

test("cropped slash-cell scoring returns incomplete without inventing missing rows", async () => {
  for (const [maxima, total] of [[[2, 3], 20], [[1, 1, 2], 12]] as const) {
    const source = `Criterion Score\n${maxima.map(value => `Visible criterion\n/${value}`).join("\n")}\nOverall Score\n/${total}`;
    const audit = auditRubricSource(source);
    assert.equal(audit.kind, "incomplete");
    assert.deepEqual(audit.rowMaxima, maxima);
    assert.equal(auditRubricSource(`Strong\n1 point\nNeeds improvement\n0.5 points\n${source}`).kind, "incomplete");
    await assert.rejects(structureRubric(source, {
      cacheRedisOverride: null,
      modelCaller: async () => { assert.fail("source incompleteness should be detected before model use"); },
    }), /RUBRIC_INCOMPLETE/);
  }
  assert.equal(auditRubricSource("Part A /2\nPart B /3\nTotal 20").kind, "unknown");
  assert.equal(auditRubricSource("Report\n/20\nPresentation\n/30\nOverall Score\n/100").kind, "unknown");
  assert.equal(auditRubricSource("Criterion Score\nResearch\n/5\nWriting 10 points\nStyle\n/5\nOverall Score\n/20").kind, "unknown");
});

test("explicit numeric penalties and bonuses defer to extraction so adjustment rules are preserved", () => {
  for (const rule of ["Deduct 5 points if no bibliography is provided.", "Late submission: 10% penalty per day.", "Bonus 3 points for the optional appendix.", "Penalty:\nDeduct\n5 points for missing references."]) {
    assert.equal(auditRubricSource(`${lmsSource}\n${rule}`).kind, "unknown");
    assert.equal(auditRubricSource(`Reasoning and presentation\nF\n0-8\nC\n9-15\nA\n16-20\n${rule}`).kind, "unknown");
    assert.equal(auditRubricSource(`Research (60%)\n/60\nWriting (40%)\n/40\n${rule}`).kind, "unknown");
  }
});

test("contradictory numbered tables require independent explicit totals and never rescale row weights", async () => {
  const source = "Total points for the assignment is 25 points.\nMAXIMUM POINTS\n1\nQuestion\n4\nChoose a clear question.\n2\nEvidence\n4\nSupport your reasoning.\n3\nConclusion\n4\nAnswer your question.\nTOTAL\n12";
  const audit = auditRubricSource(source);
  assert.equal(audit.kind, "points_conflict");
  assert.deepEqual(audit.rowMaxima, [4, 4, 4]);
  assert.deepEqual(audit.statedTotals?.sort((a, b) => a - b), [12, 25]);
  await assert.rejects(structureRubric(source, {
    cacheRedisOverride: null,
    modelCaller: async () => { assert.fail("source conflict should be detected before model use"); },
  }), /RUBRIC_POINTS_CONFLICT/);
  assert.equal(auditRubricSource(source.replace("TOTAL\n12", "")).kind, "unknown");
  const sections = "Report\nMaximum points\n1\nClarity\n4\n2\nEvidence\n6\nTotal\n10\nPresentation\nMaximum points\n1\nDelivery\n5\n2\nSlides\n5\nTotal\n10\nOverall total: 20";
  assert.equal(auditRubricSource(sections).kind, "unknown", "independent section totals must not be mistaken for source conflicts");
});

test("deterministic supported layouts succeed without a provider and can be cached", async () => {
  let stored: unknown;
  const result = await structureRubric(lmsSource, {
    cacheIdentity: { userIdType: "customer", userIdValue: "synthetic-layout" },
    cacheRedisOverride: { get: async () => null, set: async (_key, value) => { stored = JSON.parse(value); }, incr: async () => 1 },
    modelCaller: async () => { assert.fail("supported scoring layout should not need a provider"); },
  });
  assert.deepEqual(result, stored);
  assert.equal(result.total_score, 40);
});

test("unsupported model source-error claims retry and remain technical failures", async () => {
  let calls = 0;
  await assert.rejects(structureRubric("Reasoning and evidence are required.", {
    cacheRedisOverride: null,
    modelCaller: async () => { calls++; return { source_validation: { status: "incomplete" }, criteria: [] }; },
  }), /RUBRIC_STRUCTURE_FAILED/);
  assert.equal(calls, 2);
});

test("genuine model quotations cannot turn a section subtotal into a whole-rubric input conflict", async () => {
  const source = "Overall total: 30 points.\nReport\nReasoning maximum 8 points.\nEvidence maximum 12 points.\nTable total: 20 points.\nPresentation maximum 10 points.";
  let calls = 0;
  await assert.rejects(structureRubric(source, {
    cacheRedisOverride: null,
    modelCaller: async () => {
      calls++;
      return { criteria: [], source_validation: {
        status: "points_conflict", total: { points: 30, quote: "Overall total: 30 points." },
        rows: [{ points: 8, quote: "Reasoning maximum 8 points." }, { points: 12, quote: "Evidence maximum 12 points." }],
        table_total: { points: 20, quote: "Table total: 20 points." },
      } };
    },
  }), /RUBRIC_STRUCTURE_FAILED/);
  assert.equal(calls, 2);
});
