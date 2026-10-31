import type { Locale } from "../i18n/config";
import { translate } from "../i18n/translate";
import type { FinalEvaluation } from "../../lib/gradeFinalization";

export const SCORE_RANGE_NOTICE = "AI-estimated output range, not a statistically calibrated confidence interval.";
export const SCORE_COMPARISON_NOTICE = "Mode changes are not revision gains. Compare revisions using the same rubric and grading mode; AI estimates can still vary.";

export function formatOverallScoreDisplay([low, high]: [number, number]): string {
  return low === high ? String(low) : `${low}~${high}`;
}

export function explainScoreCalculation(result: {
  overall_range: [number, number];
  score_calculation?: FinalEvaluation["score_calculation"];
}, locale: Locale = "en"): string {
  const t = (text: string) => translate(locale, text);
  const calculation = result.score_calculation;
  if (calculation?.version !== "rubric-sum-v2" && calculation?.version !== "rubric-sum-v3") {
    return t("Saved result from an earlier scoring method. It may include a mode adjustment or a narrowed range; compare revisions only with results using the same scoring method.");
  }
  if (!Array.isArray(calculation.criteria_range_sum) || calculation.criteria_range_sum.length !== 2 ||
      !calculation.criteria_range_sum.every(Number.isFinite) ||
      !Number.isFinite(calculation.rubric_total) || calculation.rubric_total <= 0) {
    return t("Calculation details are unavailable for this saved result.");
  }
  const [low, high] = calculation.criteria_range_sum;
  if (calculation.version === "rubric-sum-v3") {
    if (!Number.isFinite(calculation.rubric_adjustment)) return t("Calculation details are unavailable for this saved result.");
    return translate(locale, "Criterion range totals {low}-{high}, plus rubric adjustments {adjustment}, divided by the base rubric total {total} x 100, give {range} / 100 (bounded to 0-100). Bonus and deduction rules do not increase the base total.", { low, high, adjustment: calculation.rubric_adjustment!, total: calculation.rubric_total, range: formatOverallScoreDisplay(result.overall_range) });
  }
  return translate(locale, "Criterion range totals {low}-{high}, divided by the rubric total {total} x 100 and rounded, give {range} / 100. No mode bonus or penalty is added. Individual point scores are separate model estimates; this total uses the range endpoints.", { low, high, total: calculation.rubric_total, range: formatOverallScoreDisplay(result.overall_range) });
}
