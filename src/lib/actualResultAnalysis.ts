import { compareActualResult, type ActualResult } from "./actualResultTypes";

// Offline descriptive analysis only; never imported by grading or public-gallery routes.
// Supply current records from one account at a time, not historical consent snapshots.
export function analyzeActualResults(records: ActualResult[]) {
  const latest = new Map<string, ActualResult>();
  for (const record of records) {
    const previous = latest.get(record.evaluationId);
    if (!previous || record.updatedAt >= previous.updatedAt) latest.set(record.evaluationId, record);
  }
  const eligible = [...latest.values()].filter(record =>
    record.consent.qualityValidation && record.score !== null && record.submissionMatch === "same");
  const groups = new Map<string, ActualResult[]>();
  for (const record of eligible) {
    const provenance = record.estimate.provenance;
    const key = JSON.stringify([record.assignmentType, record.estimate.mode, record.estimate.scoringVersion,
      provenance?.model ?? null, provenance?.promptVersion ?? null]);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return {
    calibrationStatus: "not_established",
    note: "Self-reported, consented observations only; descriptive context, not proof of accuracy. Small samples do not justify automatic score correction. Public-case consent is separate. Validate model or prompt changes on independently held-out assignments.",
    groups: [...groups.values()].map(items => {
      const first = items[0];
      const comparisons = items.map(record => compareActualResult(record)!);
      const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
      const repeats = new Map<string, ActualResult[]>();
      for (const record of items) {
        const provenance = record.estimate.provenance;
        // Unknown legacy versions cannot establish comparable repeated runs.
        if (!provenance?.inputFingerprint || !provenance.model || !provenance.promptVersion || !record.estimate.scoringVersion) continue;
        const key = provenance.inputFingerprint;
        repeats.set(key, [...(repeats.get(key) ?? []), record]);
      }
      const repeated = [...repeats.values()].filter(runs => runs.length > 1 &&
        runs.every(run => run.score! / run.maxScore === runs[0].score! / runs[0].maxScore));
      return {
        assignmentType: first.assignmentType, mode: first.estimate.mode,
        scoringVersion: first.estimate.scoringVersion,
        model: first.estimate.provenance?.model ?? null, promptVersion: first.estimate.provenance?.promptVersion ?? null,
        observationCount: items.length,
        distinctKnownInputs: repeats.size,
        observationsWithoutComparableProvenance: items.length - [...repeats.values()].reduce((n, runs) => n + runs.length, 0),
        midpointMeanAbsoluteError: mean(comparisons.map(comparison => Math.abs(comparison.difference))),
        actualMinusMidpointBias: mean(comparisons.map(comparison => comparison.difference)),
        observedRangeCoverage: mean(comparisons.map(comparison => Number(comparison.withinRange))),
        meanRangeWidth: mean(items.map(record => record.estimate.overallRange[1] - record.estimate.overallRange[0])),
        repeatedInputCount: repeated.length,
        meanRepeatedMidpointSpread: repeated.length ? mean(repeated.map(runs => {
          const midpoints = runs.map(run => compareActualResult(run)!.midpoint);
          return Math.max(...midpoints) - Math.min(...midpoints);
        })) : null,
      };
    }),
  };
}
