import { z } from "zod";
import { buildFinalEvaluation } from "./gradeFinalization.ts";
import { RubricSchema, EvaluationSchema, GradingModeSchema } from "./schema.ts";

const DatasetSchema = z.object({
  data_kind: z.literal("human_graded_holdout"),
  source: z.string().trim().min(1),
  model_version: z.string().trim().min(1),
  prompt_version: z.string().trim().min(1),
  samples: z.array(z.object({
    id: z.string().trim().min(1),
    human_grade_reference: z.string().trim().min(1),
    mode: GradingModeSchema,
    rubric: RubricSchema,
    evaluation: EvaluationSchema,
    human_score: z.number().finite().nonnegative(),
  })).min(1),
});

// Offline audit only: this does not fit, enable, or claim a calibrated interval.
export function validateScoringDataset(input: unknown) {
  const dataset = DatasetSchema.parse(input);
  const seen = new Set<string>();
  const rows = dataset.samples.map(sample => {
    const key = `${sample.id}:${sample.mode}`;
    if (seen.has(key)) throw new Error("Duplicate sample and mode");
    seen.add(key);
    const total = sample.rubric.criteria.reduce((sum, c) => sum + c.max_score, 0);
    if (sample.human_score > total) throw new Error("Human score exceeds rubric total");
    const result = buildFinalEvaluation(sample.rubric, sample.evaluation, sample.mode, "pro");
    const human = sample.human_score / total * 100;
    const offset = sample.mode === "standard" ? 4 : -3;
    const shifted = result.overall_range.map(value => Math.max(0, Math.min(100, value + offset))) as [number, number];
    return { mode: sample.mode, human, current: result.overall_range, offsetOnly: shifted };
  });
  function metrics(items: typeof rows, method: "current" | "offsetOnly") {
    if (!items.length) return null;
    const mean = (f: (row: typeof rows[number]) => number) => items.reduce((sum, row) => sum + f(row), 0) / items.length;
    const error = (row: typeof rows[number]) => (row[method][0] + row[method][1]) / 2 - row.human;
    return {
      sample_count: items.length,
      midpoint_mae: mean(row => Math.abs(error(row))),
      midpoint_bias: mean(error),
      observed_range_coverage: mean(row => Number(row.human >= row[method][0] && row.human <= row[method][1])),
      mean_range_width: mean(row => row[method][1] - row[method][0]),
    };
  }
  return {
    source: dataset.source, model_version: dataset.model_version, prompt_version: dataset.prompt_version,
    calibration_status: "not_established",
    note: "Descriptive holdout metrics only. Coverage is not a calibrated confidence level. Offset-only compares +4/-3 on current ranges; it does not reproduce historical width caps. Modes are reported separately, never as revision gains.",
    by_mode: Object.fromEntries((["standard", "strict"] as const).map(mode => {
      const items = rows.filter(row => row.mode === mode);
      return [mode, { current: metrics(items, "current"), offset_only: metrics(items, "offsetOnly") }];
    })),
  };
}
