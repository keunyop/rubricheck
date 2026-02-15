import { z } from "zod";

const oneToTwoSentences = (value: string): boolean => {
  const sentenceCount = value
    .trim()
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;

  return sentenceCount >= 1 && sentenceCount <= 2;
};

const integerRangeTuple = z
  .tuple([z.number().int(), z.number().int()])
  .refine(([low, high]) => low <= high, {
    message: "estimated_range must be [low, high] with low <= high",
  });

export const RubricSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string(),
      max_score: z.number().positive(),
      description: z.string(),
    }),
  ).min(2),
});

export const EvaluationSchema = z.object({
  summary: z.string().max(280).refine(oneToTwoSentences, {
    message: "summary must be 1-2 sentences",
  }),
  criteria_scores: z.array(
    z.object({
      name: z.string(),
      estimated_range: integerRangeTuple,
      feedback: z
        .string()
        .max(140)
        .refine((value) => !/[\r\n]/.test(value), {
          message: "feedback must be single-line",
        }),
    }),
  ),
  top_improvements: z
    .array(z.string().max(120))
    .length(3),
});

export type Rubric = z.infer<typeof RubricSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
