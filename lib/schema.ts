import { z } from "zod";

export const GradingModeSchema = z.enum(["standard", "strict"]);

const integerRangeTuple = z
  .tuple([z.number().int(), z.number().int()])
  .refine(([low, high]) => low <= high, {
    message: "estimated_range must be [low, high] with low <= high",
  });

const rationaleLineSchema = z
  .string()
  .max(220)
  .refine((value) => !/[\r\n]/.test(value), {
    message: "text must be single-line",
  });

const feedbackLineSchema = z
  .string()
  .max(1200)
  .refine((value) => !/[\r\n]/.test(value), {
    message: "text must be single-line",
  });

const evidenceArraySchema = z.array(z.string().trim().min(1).max(220)).min(1).max(2);

export const CriterionResultSchema = z.object({
  name: z.string(),
  score: z.number().int().nonnegative(),
  rationale: rationaleLineSchema,
  evidence: evidenceArraySchema.optional(),
});

export const StrictCriterionResultSchema = CriterionResultSchema.extend({
  evidence: evidenceArraySchema,
});

const EvaluationCriterionSchema = z.object({
  name: z.string(),
  score: z.number().int().nonnegative(),
  rationale: rationaleLineSchema,
  estimated_range: integerRangeTuple,
  feedback: feedbackLineSchema,
  evidence: evidenceArraySchema.optional(),
  detailed_breakdown: z.string().max(2400).optional(),
  example_revisions: z.array(z.string().trim().min(1).max(300)).min(1).max(2).optional(),
});

const StrictEvaluationCriterionSchema = EvaluationCriterionSchema.extend({
  evidence: evidenceArraySchema,
});

export const RubricSchema = z.object({
  total_score: z.number().positive().optional(),
  criteria: z.array(
    z.object({
      name: z.string(),
      max_score: z.number().positive(),
      description: z.string(),
    }),
  ).min(1),
  adjustments: z.array(z.object({
    name: z.string().trim().min(1),
    kind: z.enum(["deduction", "bonus"]),
    max_points: z.number().positive(),
    description: z.string(),
  })).optional(),
}).refine(rubric => rubric.total_score === undefined || Math.abs(rubric.criteria.reduce((sum, row) => sum + row.max_score, 0) - rubric.total_score) < 0.000001, {
  message: "base criterion weights must sum to total_score, excluding deductions and bonuses",
  path: ["total_score"],
});

const scoreAdjustmentsSchema = z.array(z.object({
  name: z.string().trim().min(1),
  points: z.number().int().nonnegative(),
  rationale: rationaleLineSchema,
  evidence: evidenceArraySchema.optional(),
})).optional();

// The prompt keeps summaries concise, while normalization applies the hard
// 280-character bound. Do not infer sentence counts from punctuation: periods
// in abbreviations, initials, and decimals are not reliable sentence breaks.
const evaluationSummarySchema = z.string().trim().min(1).max(280);

export const EvaluationSchema = z.object({
  score_adjustments: scoreAdjustmentsSchema,
  summary: evaluationSummarySchema,
  criteria_scores: z.array(EvaluationCriterionSchema),
  top_improvements: z
    .array(z.string().max(120))
    .length(3),
});

export const StrictEvaluationSchema = z.object({
  score_adjustments: scoreAdjustmentsSchema,
  summary: evaluationSummarySchema,
  criteria_scores: z.array(StrictEvaluationCriterionSchema),
  top_improvements: z
    .array(z.string().max(120))
    .length(3),
});

export type Rubric = z.infer<typeof RubricSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type StrictEvaluation = z.infer<typeof StrictEvaluationSchema>;
export type CriterionResult = z.infer<typeof CriterionResultSchema>;
export type StrictCriterionResult = z.infer<typeof StrictCriterionResultSchema>;
export type GradingMode = z.infer<typeof GradingModeSchema>;
