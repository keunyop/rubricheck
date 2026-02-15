import { z } from "zod";

export const RubricSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string(),
      max_score: z.number(),
      description: z.string(),
    }),
  ),
});

export const EvaluationSchema = z.object({
  overall_range: z.tuple([z.number(), z.number()]),
  summary: z.string(),
  criteria_scores: z.array(
    z.object({
      name: z.string(),
      estimated_range: z.tuple([z.number(), z.number()]),
      feedback: z.string(),
    }),
  ),
  top_improvements: z.array(z.string()).min(3).max(5),
});

export type Rubric = z.infer<typeof RubricSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
